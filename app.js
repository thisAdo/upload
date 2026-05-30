(function () {
    'use strict';

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');
    const filesCard = document.getElementById('filesCard');
    const filesList = document.getElementById('filesList');
    const fileCount = document.getElementById('fileCount');
    const githubToken = document.getElementById('githubToken');
    const toggleToken = document.getElementById('toggleToken');
    const repoPath = document.getElementById('repoPath');
    const commitMessage = document.getElementById('commitMessage');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressCard = document.getElementById('progressCard');
    const progressBar = document.getElementById('progressBar');
    const progressCount = document.getElementById('progressCount');
    const progressStatus = document.getElementById('progressStatus');
    const resultCard = document.getElementById('resultCard');
    const resultContent = document.getElementById('resultContent');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const themeToggle = document.getElementById('themeToggle');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // Toggles
    const updateExistingToggle = document.getElementById('updateExisting');
    const deleteBeforeToggle = document.getElementById('deleteBefore');

    // State
    let currentZip = null;
    let extractedFiles = [];

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    function setProgress(percent, current, total, status) {
        progressBar.style.width = `${percent}%`;
        progressCount.textContent = `${current} / ${total}`;
        progressStatus.textContent = status;
    }

    async function readGitHubResponse(response) {
        const text = await response.text();

        try {
            return text ? JSON.parse(text) : {};
        } catch {
            return { message: text || response.statusText };
        }
    }

    async function githubFetchJSON(url, options = {}, retryOptions = {}) {
        const maxRetries = retryOptions.retries ?? 5;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(url, options);
            const data = await readGitHubResponse(response);

            if (response.ok) return data;

            const message = data?.message || `Error HTTP ${response.status}`;

            const isSecondaryLimit =
                response.status === 403 &&
                /secondary rate limit|abuse detection|rate limit/i.test(message);

            const isRetryable =
                response.status === 429 ||
                response.status >= 500 ||
                isSecondaryLimit;

            if (isRetryable && attempt < maxRetries) {
                const retryAfter = Number(response.headers.get('retry-after') || 0);

                const delay = retryAfter > 0
                    ? retryAfter * 1000
                    : Math.min(8000 * Math.pow(2, attempt), 60000);

                setProgress(
                    50,
                    0,
                    0,
                    `GitHub limitó temporalmente la subida. Reintentando en ${Math.ceil(delay / 1000)}s...`
                );

                await sleep(delay);
                continue;
            }

            throw new Error(message);
        }

        throw new Error('GitHub no respondió correctamente.');
    }

    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 8192;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }

        return btoa(binary);
    }

    function getFileExtension(filename) {
        const clean = String(filename || '').split('?')[0].split('#')[0];
        const parts = clean.split('.');

        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function uint8ToText(bytes) {
        return new TextDecoder('utf-8').decode(bytes);
    }

    function shouldIgnoreZipPath(path) {
        const normalized = String(path || '').replace(/\\/g, '/');

        return (
            normalized.startsWith('__MACOSX/') ||
            normalized.includes('/.git/') ||
            normalized.startsWith('.git/') ||
            normalized.includes('/node_modules/') ||
            normalized.startsWith('node_modules/') ||
            normalized.includes('/.next/') ||
            normalized.startsWith('.next/') ||
            normalized.includes('/dist/') ||
            normalized.startsWith('dist/') ||
            normalized.includes('/build/') ||
            normalized.startsWith('build/') ||
            normalized.endsWith('.DS_Store')
        );
    }

    function isInlineTextFile(file) {
        const target = file.name || file.path || '';
        const ext = getFileExtension(target);
        const basename = target.split('/').pop().toLowerCase();

        const textExtensions = new Set([
            'js', 'mjs', 'cjs',
            'ts', 'tsx', 'jsx',
            'json',
            'html', 'css', 'scss', 'sass',
            'md', 'txt',
            'yml', 'yaml',
            'xml',
            'env',
            'gitignore',
            'dockerignore',
            'sh', 'bash', 'zsh',
            'py', 'rb', 'php', 'java', 'go', 'rs',
            'c', 'cpp', 'h', 'hpp',
            'sql',
            'toml', 'ini', 'conf',
            'lock',
            'svg'
        ]);

        const textNames = new Set([
            '.env',
            '.gitignore',
            '.dockerignore',
            'dockerfile',
            'license',
            'readme'
        ]);

        if (!file.content || file.content.length > 900 * 1024) return false;

        const looksTextByName = textExtensions.has(ext) || textNames.has(basename);

        if (!looksTextByName) return false;

        const sample = file.content.subarray(0, Math.min(file.content.length, 8000));

        for (const byte of sample) {
            if (byte === 0) return false;
        }

        return true;
    }

    async function buildTreeEntries(files, owner, repoName, headers) {
        const tree = [];
        const binaryFiles = [];

        for (const file of files) {
            if (isInlineTextFile(file)) {
                tree.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    content: uint8ToText(file.content)
                });
            } else {
                binaryFiles.push(file);
            }
        }

        if (binaryFiles.length === 0) {
            return tree;
        }

        for (let i = 0; i < binaryFiles.length; i++) {
            const file = binaryFiles[i];

            setProgress(
                Math.round(10 + ((i + 1) / binaryFiles.length) * 55),
                i + 1,
                binaryFiles.length,
                `Subiendo binario: ${file.path}`
            );

            const blobData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        content: arrayBufferToBase64(file.content),
                        encoding: 'base64'
                    })
                },
                { retries: 6 }
            );

            if (!blobData?.sha) {
                throw new Error(`GitHub no devolvió SHA para: ${file.path}`);
            }

            tree.push({
                path: file.path,
                sha: blobData.sha,
                mode: '100644',
                type: 'blob'
            });

            await sleep(900);
        }

        return tree;
    }

    function showResult(success, title, message, link) {
        const safeTitle = escapeHTML(title);
        const safeMessage = escapeHTML(message);
        const safeLink = link ? escapeHTML(link) : '';

        resultCard.style.display = 'block';
        resultContent.className = `result-content ${success ? 'success' : 'error'}`;

        resultContent.innerHTML = `
            <div class="result-icon">
                ${
                    success
                        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
                        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
                }
            </div>
            <h2 class="result-title">${safeTitle}</h2>
            <p class="result-message">${safeMessage}</p>
            ${
                safeLink
                    ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="result-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Ver commit en GitHub</a>`
                    : ''
            }
        `;

        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function validateForm() {
        const isValid =
            currentZip &&
            githubToken.value.trim() &&
            repoPath.value.trim() &&
            commitMessage.value.trim();

        uploadBtn.disabled = !isValid;
    }

    function getDriveIconColor(filename) {
        const ext = filename.split('.').pop().toLowerCase();

        const iconColors = {
            js: '#eab308',
            ts: '#3b82f6',
            jsx: '#06b6d4',
            tsx: '#3b82f6',
            json: '#64748b',
            html: '#ef4444',
            css: '#3b82f6',
            scss: '#ec4899',
            py: '#3b82f6',
            sh: '#22c55e',
            png: '#8b5cf6',
            jpg: '#8b5cf6',
            jpeg: '#8b5cf6',
            gif: '#8b5cf6',
            webp: '#8b5cf6',
            svg: '#8b5cf6',
            txt: '#64748b',
            pdf: '#ef4444'
        };

        return iconColors[ext] || '#94a3b8';
    }

    function getFileIconSvg(filename) {
        const ext = filename.split('.').pop().toLowerCase();

        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        }

        if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sh'].includes(ext)) {
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
        }

        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }

    function renderFilesList(files) {
        filesList.innerHTML = '';

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';

            const icon = document.createElement('div');
            icon.className = 'file-item-icon';
            icon.style.color = getDriveIconColor(file.name);
            icon.innerHTML = getFileIconSvg(file.name);

            const info = document.createElement('div');
            info.className = 'file-item-info';

            const name = document.createElement('div');
            name.className = 'file-item-name';
            name.title = file.name;
            name.textContent = file.name;

            const path = document.createElement('div');
            path.className = 'file-item-path';
            path.title = file.path;
            path.textContent = file.path;

            const size = document.createElement('div');
            size.className = 'file-item-size';
            size.textContent = formatFileSize(file.size || 0);

            info.appendChild(name);
            info.appendChild(path);

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(size);

            filesList.appendChild(item);
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    }

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    }

    async function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert('Por favor, selecciona un archivo ZIP.');
            return;
        }

        showLoading(true);

        try {
            const arrayBuffer = await file.arrayBuffer();

            currentZip = await JSZip.loadAsync(arrayBuffer);
            extractedFiles = [];

            const promises = [];

            currentZip.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) return;
                if (shouldIgnoreZipPath(relativePath)) return;

                promises.push(
                    zipEntry.async('uint8array').then(content => {
                        const cleanPath = relativePath
                            .replace(/\\/g, '/')
                            .replace(/^\/+/, '');

                        extractedFiles.push({
                            name: cleanPath.split('/').pop(),
                            path: cleanPath,
                            size: content.length,
                            content
                        });
                    })
                );
            });

            await Promise.all(promises);

            extractedFiles.sort((a, b) => a.path.localeCompare(b.path));

            if (extractedFiles.length === 0) {
                throw new Error('El ZIP no contiene archivos válidos.');
            }

            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);

            filePreview.style.display = 'block';
            filesCard.style.display = 'block';
            fileCount.textContent = `${extractedFiles.length} archivos`;

            renderFilesList(extractedFiles);
            validateForm();
        } catch (error) {
            console.error('Error extracting ZIP:', error);
            alert(error.message || 'Error al extraer el archivo ZIP.');
        } finally {
            showLoading(false);
        }
    }

    function clearFile() {
        currentZip = null;
        extractedFiles = [];
        fileInput.value = '';

        filePreview.style.display = 'none';
        filesCard.style.display = 'none';
        resultCard.style.display = 'none';
        progressCard.style.display = 'none';

        filesList.innerHTML = '';
        validateForm();
    }

    function toggleTokenVisibility() {
        const isPassword = githubToken.type === 'password';

        githubToken.type = isPassword ? 'text' : 'password';

        const eye = toggleToken.querySelector('.icon-eye');
        const eyeOff = toggleToken.querySelector('.icon-eye-off');

        if (eye) eye.style.display = isPassword ? 'none' : 'block';
        if (eyeOff) eyeOff.style.display = isPassword ? 'block' : 'none';
    }

    function validateRepoPath(path) {
        return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(path);
    }

    async function uploadToGitHub() {
        const token = githubToken.value.trim();
        const repo = repoPath.value.trim();
        const message = commitMessage.value.trim();
        const updateExisting = updateExistingToggle.checked;
        const deleteBefore = deleteBeforeToggle.checked;

        if (!validateRepoPath(repo)) {
            alert('Formato de repositorio inválido. Usa: propietario/repositorio');
            return;
        }

        if (!extractedFiles.length) {
            alert('Primero selecciona un ZIP válido.');
            return;
        }

        const [owner, repoName] = repo.split('/');

        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        resultCard.style.display = 'none';
        progressCard.style.display = 'block';
        uploadBtn.disabled = true;

        setProgress(0, 0, extractedFiles.length, 'Obteniendo información del repositorio...');

        try {
            const cleanFiles = extractedFiles.filter(file => !shouldIgnoreZipPath(file.path));

            if (!cleanFiles.length) {
                throw new Error('El ZIP no contiene archivos válidos para subir.');
            }

            const repoData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}`,
                { headers }
            );

            const defaultBranch = repoData.default_branch;

            if (!defaultBranch) {
                throw new Error('No se pudo detectar la rama principal del repositorio.');
            }

            setProgress(3, 0, cleanFiles.length, `Leyendo rama ${defaultBranch}...`);

            const refData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`,
                { headers }
            );

            const latestCommitSha = refData?.object?.sha;

            if (!latestCommitSha) {
                throw new Error('No se pudo leer el SHA del último commit.');
            }

            setProgress(5, 0, cleanFiles.length, 'Obteniendo árbol base...');

            const latestCommitData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`,
                { headers }
            );

            const latestTreeSha = latestCommitData?.tree?.sha;

            if (!latestTreeSha) {
                throw new Error('No se pudo leer el SHA del árbol base.');
            }

            let filesToUpload = cleanFiles;

            if (!deleteBefore && !updateExisting) {
                setProgress(8, 0, cleanFiles.length, 'Verificando archivos existentes...');

                const existingTreeData = await githubFetchJSON(
                    `https://api.github.com/repos/${owner}/${repoName}/git/trees/${latestTreeSha}?recursive=1`,
                    { headers }
                );

                const existingPaths = new Set(
                    (existingTreeData.tree || [])
                        .filter(item => item.type === 'blob')
                        .map(item => item.path)
                );

                filesToUpload = cleanFiles.filter(file => !existingPaths.has(file.path));

                if (!filesToUpload.length) {
                    throw new Error('No hay archivos nuevos para subir. Todos ya existen.');
                }
            }

            setProgress(10, 0, filesToUpload.length, 'Preparando árbol de archivos...');

            const treeEntries = await buildTreeEntries(filesToUpload, owner, repoName, headers);

            if (!treeEntries.length) {
                throw new Error('No hay archivos válidos para crear el commit.');
            }

            setProgress(75, filesToUpload.length, filesToUpload.length, 'Creando árbol en GitHub...');

            const treePayload = {
                tree: treeEntries
            };

            if (!deleteBefore) {
                treePayload.base_tree = latestTreeSha;
            }

            const treeData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(treePayload)
                },
                { retries: 5 }
            );

            if (!treeData?.sha) {
                throw new Error('GitHub no devolvió SHA del árbol creado.');
            }

            setProgress(88, filesToUpload.length, filesToUpload.length, 'Creando un solo commit...');

            const commitData = await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message,
                        tree: treeData.sha,
                        parents: [latestCommitSha]
                    })
                },
                { retries: 5 }
            );

            if (!commitData?.sha) {
                throw new Error('GitHub no devolvió SHA del commit creado.');
            }

            setProgress(96, filesToUpload.length, filesToUpload.length, 'Actualizando rama...');

            await githubFetchJSON(
                `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`,
                {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        sha: commitData.sha,
                        force: false
                    })
                },
                { retries: 5 }
            );

            setProgress(100, filesToUpload.length, filesToUpload.length, '¡Completado!');

            const commitUrl = `https://github.com/${owner}/${repoName}/commit/${commitData.sha}`;

            setTimeout(() => {
                progressCard.style.display = 'none';

                showResult(
                    true,
                    '¡Archivos subidos exitosamente!',
                    `Se subieron ${filesToUpload.length} archivos en un solo commit a ${owner}/${repoName} (${defaultBranch}).`,
                    commitUrl
                );
            }, 500);
        } catch (error) {
            console.error('Error al subir archivos:', error);

            progressCard.style.display = 'none';

            showResult(
                false,
                'Error al subir archivos',
                error.message || 'Ocurrió un error desconocido.'
            );

            uploadBtn.disabled = false;
        }
    }

    function initTheme() {
        const theme = localStorage.getItem('adzup-theme');

        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');

        localStorage.setItem(
            'adzup-theme',
            document.body.classList.contains('dark-mode') ? 'dark' : 'light'
        );
    }

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }

    // Event Listeners
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    fileInput.addEventListener('change', handleFileSelect);
    removeFile.addEventListener('click', clearFile);

    toggleToken.addEventListener('click', toggleTokenVisibility);

    githubToken.addEventListener('input', validateForm);
    repoPath.addEventListener('input', validateForm);
    commitMessage.addEventListener('input', validateForm);

    uploadBtn.addEventListener('click', uploadToGitHub);

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    deleteBeforeToggle.addEventListener('change', e => {
        if (e.target.checked) {
            updateExistingToggle.checked = false;
            updateExistingToggle.disabled = true;
        } else {
            updateExistingToggle.disabled = false;
            updateExistingToggle.checked = true;
        }
    });

    initTheme();
    validateForm();
})();