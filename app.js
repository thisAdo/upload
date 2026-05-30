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

    const GRAPHQL_URL = 'https://api.github.com/graphql';

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
        progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        progressCount.textContent = `${current} / ${total}`;
        progressStatus.textContent = status;
    }

    async function readResponseText(response) {
        const text = await response.text();

        try {
            return text ? JSON.parse(text) : {};
        } catch {
            return { message: text || response.statusText };
        }
    }

    async function graphqlRequest(token, query, variables = {}, retryOptions = {}) {
        const maxRetries = retryOptions.retries ?? 4;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            const data = await readResponseText(response);

            const graphQLError = Array.isArray(data.errors) && data.errors.length
                ? data.errors.map(error => error.message).join(' | ')
                : '';

            if (response.ok && !graphQLError) {
                return data.data;
            }

            const message =
                graphQLError ||
                data?.message ||
                `Error HTTP ${response.status}`;

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
                    : Math.min(10000 * Math.pow(2, attempt), 60000);

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

    function validateRepoPath(path) {
        return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(path);
    }

    function normalizeZipPath(path) {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+/g, '/');
    }

    function shouldIgnoreZipPath(path) {
        const normalized = normalizeZipPath(path);

        return (
            !normalized ||
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
            normalized.includes('/.cache/') ||
            normalized.startsWith('.cache/') ||
            normalized.endsWith('.DS_Store')
        );
    }

    function uint8ToBase64(bytes) {
        let binary = '';
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

    function getDriveIconColor(filename) {
        const ext = getFileExtension(filename);

        const iconColors = {
            js: '#eab308',
            mjs: '#eab308',
            cjs: '#eab308',
            ts: '#3b82f6',
            jsx: '#06b6d4',
            tsx: '#3b82f6',
            json: '#64748b',
            html: '#ef4444',
            css: '#3b82f6',
            scss: '#ec4899',
            sass: '#ec4899',
            py: '#3b82f6',
            sh: '#22c55e',
            png: '#8b5cf6',
            jpg: '#8b5cf6',
            jpeg: '#8b5cf6',
            gif: '#8b5cf6',
            webp: '#8b5cf6',
            svg: '#8b5cf6',
            txt: '#64748b',
            md: '#64748b',
            pdf: '#ef4444',
            zip: '#f97316'
        };

        return iconColors[ext] || '#94a3b8';
    }

    function getFileIconSvg(filename) {
        const ext = getFileExtension(filename);

        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        }

        if (['js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sh'].includes(ext)) {
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
            extractedFiles.length > 0 &&
            githubToken.value.trim() &&
            repoPath.value.trim() &&
            commitMessage.value.trim();

        uploadBtn.disabled = !isValid;
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
                const cleanPath = normalizeZipPath(relativePath);

                if (zipEntry.dir) return;
                if (shouldIgnoreZipPath(cleanPath)) return;

                promises.push(
                    zipEntry.async('uint8array').then(content => {
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

    async function getRepositoryHead(token, owner, repoName) {
        const query = `
            query GetRepositoryHead($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                    nameWithOwner
                    defaultBranchRef {
                        name
                        target {
                            ... on Commit {
                                oid
                            }
                        }
                    }
                }
            }
        `;

        const data = await graphqlRequest(token, query, {
            owner,
            name: repoName
        });

        const repo = data?.repository;
        const branchName = repo?.defaultBranchRef?.name;
        const headOid = repo?.defaultBranchRef?.target?.oid;

        if (!repo) {
            throw new Error('Repositorio no encontrado o token sin permisos.');
        }

        if (!branchName || !headOid) {
            throw new Error('No se pudo leer la rama principal del repositorio.');
        }

        return {
            repositoryNameWithOwner: repo.nameWithOwner,
            branchName,
            headOid
        };
    }

    function buildGraphQLAdditions(files) {
        return files.map(file => ({
            path: file.path,
            contents: uint8ToBase64(file.content)
        }));
    }

    async function createCommitWithAllFiles(token, repoInfo, message, files) {
        const mutation = `
            mutation CreateCommit(
                $repositoryNameWithOwner: String!,
                $branchName: String!,
                $expectedHeadOid: GitObjectID!,
                $headline: String!,
                $additions: [FileAddition!]!
            ) {
                createCommitOnBranch(
                    input: {
                        branch: {
                            repositoryNameWithOwner: $repositoryNameWithOwner,
                            branchName: $branchName
                        },
                        message: {
                            headline: $headline
                        },
                        expectedHeadOid: $expectedHeadOid,
                        fileChanges: {
                            additions: $additions
                        }
                    }
                ) {
                    commit {
                        oid
                        url
                    }
                }
            }
        `;

        const additions = buildGraphQLAdditions(files);

        const data = await graphqlRequest(
            token,
            mutation,
            {
                repositoryNameWithOwner: repoInfo.repositoryNameWithOwner,
                branchName: repoInfo.branchName,
                expectedHeadOid: repoInfo.headOid,
                headline: message,
                additions
            },
            { retries: 4 }
        );

        const commit = data?.createCommitOnBranch?.commit;

        if (!commit?.oid || !commit?.url) {
            throw new Error('GitHub no devolvió el commit creado.');
        }

        return commit;
    }

    async function uploadToGitHub() {
        const token = githubToken.value.trim();
        const repo = repoPath.value.trim();
        const message = commitMessage.value.trim();
        const deleteBefore = deleteBeforeToggle.checked;

        if (!validateRepoPath(repo)) {
            alert('Formato de repositorio inválido. Usa: propietario/repositorio');
            return;
        }

        if (!extractedFiles.length) {
            alert('Primero selecciona un ZIP válido.');
            return;
        }

        if (deleteBefore) {
            showResult(
                false,
                'Opción no compatible',
                'El modo GraphQL de pocas requests no puede borrar todo el repo sin listar archivos antes. Desactiva "Borrar todo antes" y vuelve a intentar.'
            );
            return;
        }

        const [owner, repoName] = repo.split('/');

        resultCard.style.display = 'none';
        progressCard.style.display = 'block';
        uploadBtn.disabled = true;

        try {
            const cleanFiles = extractedFiles.filter(file => !shouldIgnoreZipPath(file.path));

            if (!cleanFiles.length) {
                throw new Error('El ZIP no contiene archivos válidos para subir.');
            }

            const totalBytes = cleanFiles.reduce((acc, file) => acc + file.content.length, 0);
            const totalBase64Bytes = Math.ceil(totalBytes * 1.37);

            if (totalBase64Bytes > 35 * 1024 * 1024) {
                throw new Error(
                    `El ZIP descomprimido es muy grande para subirlo en una sola petición GraphQL (${formatFileSize(totalBytes)}). Quita archivos pesados o sube menos archivos.`
                );
            }

            setProgress(5, 0, cleanFiles.length, 'Leyendo rama principal...');

            const repoInfo = await getRepositoryHead(token, owner, repoName);

            setProgress(35, 0, cleanFiles.length, 'Guardando archivos en RAM...');

            const additions = buildGraphQLAdditions(cleanFiles);

            if (!additions.length) {
                throw new Error('No hay archivos válidos para subir.');
            }

            setProgress(65, cleanFiles.length, cleanFiles.length, 'Subiendo todo en una sola petición...');

            const commit = await createCommitWithAllFiles(
                token,
                repoInfo,
                message,
                cleanFiles
            );

            setProgress(100, cleanFiles.length, cleanFiles.length, '¡Completado!');

            setTimeout(() => {
                progressCard.style.display = 'none';

                showResult(
                    true,
                    '¡Archivos subidos exitosamente!',
                    `Se subieron ${cleanFiles.length} archivos en un solo commit a ${repoInfo.repositoryNameWithOwner} (${repoInfo.branchName}).`,
                    commit.url
                );

                uploadBtn.disabled = false;
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
            updateExistingToggle.checked = true;
            updateExistingToggle.disabled = true;

            showResult(
                false,
                'Aviso',
                'El modo "Borrar todo antes" necesita listar archivos y puede causar más requests. Para evitar el rate limit, déjalo desactivado.'
            );
        } else {
            updateExistingToggle.disabled = false;
            updateExistingToggle.checked = true;
        }
    });

    initTheme();
    validateForm();
})();