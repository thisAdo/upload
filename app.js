(function() {
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

    // State
    let currentZip = null;
    let extractedFiles = [];

    // Utility Functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    function setProgress(percent, current, total, status) {
        progressBar.style.width = percent + '%';
        progressCount.textContent = `${current} / ${total}`;
        progressStatus.textContent = status;
    }

    function showResult(success, title, message, link) {
        resultCard.style.display = 'block';
        resultContent.className = 'result-content ' + (success ? 'success' : 'error');

        resultContent.innerHTML = `
            <div class="result-icon">
                ${success ? `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                ` : `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                `}
            </div>
            <h2 class="result-title">${title}</h2>
            <p class="result-message">${message}</p>
            ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="result-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Ver commit en GitHub
            </a>` : ''}
        `;

        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function validateForm() {
        const isValid = currentZip &&
                        githubToken.value.trim() &&
                        repoPath.value.trim() &&
                        commitMessage.value.trim();
        uploadBtn.disabled = !isValid;
    }

    function getDriveIconColor(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconColors = {
            js: '#eab308', ts: '#3b82f6', jsx: '#06b6d4', tsx: '#3b82f6', json: '#64748b',
            html: '#ef4444', css: '#3b82f6', scss: '#ec4899', md: '#64748b', py: '#3b82f6',
            rb: '#ef4444', php: '#8b5cf6', java: '#f97316', go: '#06b6d4', rs: '#f97316',
            sh: '#22c55e', yaml: '#ef4444', yml: '#ef4444', xml: '#f97316', svg: '#eab308', 
            png: '#8b5cf6', jpg: '#8b5cf6', jpeg: '#8b5cf6', gif: '#8b5cf6', webp: '#8b5cf6', 
            txt: '#64748b', pdf: '#ef4444'
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

            const iconColor = getDriveIconColor(file.name);
            const iconSvg = getFileIconSvg(file.name);

            item.innerHTML = `
                <div class="file-item-icon" style="color: ${iconColor};">
                    ${iconSvg}
                </div>
                <div class="file-item-info">
                    <div class="file-item-name" title="${file.name}">${file.name}</div>
                    <div class="file-item-path" title="${file.path}">${file.path}</div>
                </div>
                <div class="file-item-size">${formatFileSize(file.size || 0)}</div>
            `;

            filesList.appendChild(item);
        });
    }

    // Event Handlers
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

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
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
                if (!zipEntry.dir) {
                    promises.push(
                        zipEntry.async('uint8array').then(content => {
                            extractedFiles.push({
                                name: relativePath.split('/').pop(),
                                path: relativePath,
                                size: content.length,
                                content: content
                            });
                        })
                    );
                }
            });

            await Promise.all(promises);
            extractedFiles.sort((a, b) => a.path.localeCompare(b.path));

            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            filePreview.style.display = 'block';

            filesCard.style.display = 'block';
            fileCount.textContent = `${extractedFiles.length} archivos`;
            renderFilesList(extractedFiles);

            validateForm();

        } catch (error) {
            console.error('Error extracting ZIP:', error);
            alert('Error al extraer el archivo ZIP. Asegúrate de que sea un ZIP válido.');
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
        filesList.innerHTML = '';
        resultCard.style.display = 'none';
        progressCard.style.display = 'none';
        validateForm();
    }

    function toggleTokenVisibility() {
        const isPassword = githubToken.type === 'password';
        githubToken.type = isPassword ? 'text' : 'password';
        toggleToken.querySelector('.icon-eye').style.display = isPassword ? 'none' : 'block';
        toggleToken.querySelector('.icon-eye-off').style.display = isPassword ? 'block' : 'none';
    }

    function validateRepoPath(path) {
        const regex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
        return regex.test(path);
    }

    // Prevent Maximum call stack size exceeded
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

    async function uploadToGitHub() {
        const token = githubToken.value.trim();
        const repo = repoPath.value.trim();
        const message = commitMessage.value.trim();

        if (!validateRepoPath(repo)) {
            alert('Formato de repositorio inválido. Usa el formato: propietario/repositorio');
            return;
        }

        const [owner, repoName] = repo.split('/');

        resultCard.style.display = 'none';
        progressCard.style.display = 'block';
        setProgress(0, 0, extractedFiles.length, 'Obteniendo información del repositorio...');
        uploadBtn.disabled = true;

        try {
            const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!repoResponse.ok) {
                if (repoResponse.status === 401) throw new Error('Token de GitHub inválido o sin permisos.');
                if (repoResponse.status === 404) throw new Error('Repositorio no encontrado.');
                throw new Error(`Error de GitHub: ${repoResponse.status}`);
            }

            const repoData = await repoResponse.json();
            const defaultBranch = repoData.default_branch;
            setProgress(0, 0, extractedFiles.length, `Usando rama: ${defaultBranch}`);

            const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!refResponse.ok) throw new Error('No se pudo obtener información de la rama.');

            const refData = await refResponse.json();
            const latestCommitSha = refData.object.sha;

            setProgress(5, 0, extractedFiles.length, 'Preparando archivos...');

            const blobs = [];
            for (let i = 0; i < extractedFiles.length; i++) {
                const file = extractedFiles[i];
                const base64Content = arrayBufferToBase64(file.content);

                const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: base64Content, encoding: 'base64' })
                });

                if (!blobResponse.ok) throw new Error(`Error al subir archivo: ${file.path}`);

                const blobData = await blobResponse.json();
                blobs.push({ path: file.path, sha: blobData.sha, mode: '100644', type: 'blob' });

                const percent = Math.round((i + 1) / extractedFiles.length * 80);
                setProgress(percent, i + 1, extractedFiles.length, `Subiendo: ${file.path}`);
            }

            setProgress(85, extractedFiles.length, extractedFiles.length, 'Creando árbol...');

            const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_tree: latestCommitSha, tree: blobs })
            });

            if (!treeResponse.ok) throw new Error('No se pudo crear el árbol de archivos.');
            const treeData = await treeResponse.json();

            setProgress(90, extractedFiles.length, extractedFiles.length, 'Creando commit...');

            const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, tree: treeData.sha, parents: [latestCommitSha] })
            });

            if (!commitResponse.ok) throw new Error('No se pudo crear el commit.');
            const commitData = await commitResponse.json();

            setProgress(95, extractedFiles.length, extractedFiles.length, 'Actualizando referencia...');

            const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ sha: commitData.sha, force: false })
            });

            if (!updateRefResponse.ok) throw new Error('No se pudo actualizar la rama.');

            setProgress(100, extractedFiles.length, extractedFiles.length, '¡Completado!');

            const commitUrl = `https://github.com/${owner}/${repoName}/commit/${commitData.sha}`;

            setTimeout(() => {
                progressCard.style.display = 'none';
                showResult(true, '¡Archivos subidos exitosamente!',
                    `Se han subido ${extractedFiles.length} archivos al repositorio ${owner}/${repoName} en la rama ${defaultBranch}.`,
                    commitUrl);
            }, 500);

        } catch (error) {
            progressCard.style.display = 'none';
            showResult(false, 'Error al subir archivos', error.message);
            uploadBtn.disabled = false;
        }
    }

    // Theme & UI Logic
    function initTheme() {
        const savedTheme = localStorage.getItem('adzup-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('adzup-theme', isDark ? 'dark' : 'light');
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

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    // Initialize
    initTheme();
    validateForm();
})();