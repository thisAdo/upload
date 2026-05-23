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

    // State
    let currentZip = null;
    let extractedFiles = [];
    let isDarkMode = false;

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
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                ` : `
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                `}
            </div>
            <h2 class="result-title">${title}</h2>
            <p class="result-message">${message}</p>
            ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="result-link">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Ver commit en GitHub
            </a>` : ''}
        `;

        // Scroll to result
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function validateForm() {
        const isValid = currentZip &&
                        githubToken.value.trim() &&
                        repoPath.value.trim() &&
                        commitMessage.value.trim();
        uploadBtn.disabled = !isValid;
    }

    function getDriveIconColor(filename, isFolder) {
        if (isFolder) {
            // Random folder color
            const colors = ['var(--folder-blue)', 'var(--folder-green)', 'var(--folder-yellow)',
                          'var(--folder-red)', 'var(--folder-purple)', 'var(--folder-orange)', 'var(--folder-cyan)'];
            const hash = filename.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            return colors[hash % colors.length];
        }

        const ext = filename.split('.').pop().toLowerCase();
        const iconColors = {
            js: '#f7df1e',
            ts: '#3178c6',
            jsx: '#61dafb',
            tsx: '#3178c6',
            json: '#cbcb41',
            html: '#e34f26',
            css: '#1572b6',
            scss: '#c6538c',
            md: '#083fa1',
            py: '#3776ab',
            rb: '#cc342d',
            php: '#777bb4',
            java: '#b07219',
            go: '#00add8',
            rs: '#dea584',
            c: '#555555',
            cpp: '#f34b7d',
            h: '#555555',
            sh: '#89e051',
            yaml: '#cb171e',
            yml: '#cb171e',
            xml: '#e37933',
            svg: '#ffb13b',
            png: '#a074c4',
            jpg: '#a074c4',
            jpeg: '#a074c4',
            gif: '#a074c4',
            webp: '#a074c4',
            txt: '#8c8c8c',
            pdf: '#f40f02',
            doc: '#2b579a',
            docx: '#2b579a',
            xls: '#217346',
            xlsx: '#217346',
            ppt: '#d24726',
            pptx: '#d24726'
        };

        return iconColors[ext] || '#8c8c8c';
    }

    function getFileIconSvg(filename, isFolder) {
        if (isFolder) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>`;
        }

        const ext = filename.split('.').pop().toLowerCase();

        // Image files
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>`;
        }

        // Code files
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'java', 'go', 'rs', 'c', 'cpp', 'h'].includes(ext)) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
            </svg>`;
        }

        // Default file icon
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
        </svg>`;
    }

    function renderFilesList(files) {
        filesList.innerHTML = '';

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';

            const iconColor = getDriveIconColor(file.name, false);
            const iconSvg = getFileIconSvg(file.name, false);

            item.innerHTML = `
                <div class="file-item-icon" style="background: ${iconColor}20;">
                    <span style="color: ${iconColor};">${iconSvg}</span>
                </div>
                <div class="file-item-info">
                    <div class="file-item-name">${file.name}</div>
                    <div class="file-item-path">${file.path}</div>
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

            // Sort files by path
            extractedFiles.sort((a, b) => a.path.localeCompare(b.path));

            // Update UI
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            filePreview.style.display = 'block';

            filesCard.style.display = 'block';
            fileCount.textContent = `${extractedFiles.length} archivo${extractedFiles.length !== 1 ? 's' : ''}`;
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

    async function uploadToGitHub() {
        const token = githubToken.value.trim();
        const repo = repoPath.value.trim();
        const message = commitMessage.value.trim();

        if (!validateRepoPath(repo)) {
            alert('Formato de repositorio inválido. Usa el formato: propietario/repositorio');
            return;
        }

        const [owner, repoName] = repo.split('/');

        // Hide result section if visible
        resultCard.style.display = 'none';

        // Show progress
        progressCard.style.display = 'block';
        setProgress(0, 0, extractedFiles.length, 'Obteniendo información del repositorio...');

        uploadBtn.disabled = true;

        try {
            // Get the default branch
            const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!repoResponse.ok) {
                if (repoResponse.status === 401) {
                    throw new Error('Token de GitHub inválido o sin permisos.');
                }
                if (repoResponse.status === 404) {
                    throw new Error('Repositorio no encontrado. Verifica el nombre y que el token tenga acceso.');
                }
                throw new Error(`Error de GitHub: ${repoResponse.status}`);
            }

            const repoData = await repoResponse.json();
            const defaultBranch = repoData.default_branch;

            setProgress(0, 0, extractedFiles.length, `Usando rama: ${defaultBranch}`);

            // Get the current commit SHA of the default branch
            const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!refResponse.ok) {
                throw new Error('No se pudo obtener información de la rama.');
            }

            const refData = await refResponse.json();
            const latestCommitSha = refData.object.sha;
            const treeSha = refData.object.url;

            setProgress(5, 0, extractedFiles.length, 'Preparando archivos...');

            // Create blobs for each file
            const blobs = [];
            for (let i = 0; i < extractedFiles.length; i++) {
                const file = extractedFiles[i];
                const base64Content = btoa(String.fromCharCode.apply(null, new Uint8Array(file.content)));

                const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: base64Content,
                        encoding: 'base64'
                    })
                });

                if (!blobResponse.ok) {
                    throw new Error(`Error al subir archivo: ${file.path}`);
                }

                const blobData = await blobResponse.json();
                blobs.push({
                    path: file.path,
                    sha: blobData.sha,
                    mode: '100644',
                    type: 'blob'
                });

                const percent = Math.round((i + 1) / extractedFiles.length * 80);
                setProgress(percent, i + 1, extractedFiles.length, `Subiendo: ${file.path}`);
            }

            setProgress(85, extractedFiles.length, extractedFiles.length, 'Creando árbol de archivos...');

            // Create a new tree with the files
            const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    base_tree: latestCommitSha,
                    tree: blobs
                })
            });

            if (!treeResponse.ok) {
                throw new Error('No se pudo crear el árbol de archivos.');
            }

            const treeData = await treeResponse.json();

            setProgress(90, extractedFiles.length, extractedFiles.length, 'Creando commit...');

            // Create the commit
            const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    tree: treeData.sha,
                    parents: [latestCommitSha]
                })
            });

            if (!commitResponse.ok) {
                throw new Error('No se pudo crear el commit.');
            }

            const commitData = await commitResponse.json();

            setProgress(95, extractedFiles.length, extractedFiles.length, 'Actualizando referencia...');

            // Update the branch to point to the new commit
            const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sha: commitData.sha,
                    force: false
                })
            });

            if (!updateRefResponse.ok) {
                throw new Error('No se pudo actualizar la rama.');
            }

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

    // Theme toggle (optional feature)
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            document.body.classList.toggle('dark-mode', isDarkMode);
        });
    }

    // Initialize
    validateForm();
})();