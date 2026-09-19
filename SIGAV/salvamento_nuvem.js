// Salva/carrega o progresso dos tópicos de uma trilha no Supabase.
// Requer data-api.js (window.Api) e, na página, #trilha-id, .topic-checkbox[data-key],
// #progress-bar, #progress-text e #progress-status.
document.addEventListener('DOMContentLoaded', () => {
    if (!window.Api) {
        console.warn('Supabase não disponível para salvamento na nuvem');
        return;
    }

    const trilhaEl = document.getElementById('trilha-id');
    if (!trilhaEl) return;
    const trilhaId = trilhaEl.value;
    const checkboxes = document.querySelectorAll('.topic-checkbox');
    const totalTopics = checkboxes.length;

    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressStatus = document.getElementById('progress-status');

    let currentUser = null;
    let localProgress = {};

    // A barra e os textos de status são opcionais (nem toda trilha os exibe).
    function setStatus(text, cls) {
        if (!progressStatus) return;
        progressStatus.textContent = text;
        progressStatus.className = `text-sm font-medium ${cls}`;
    }

    function updateProgressBar() {
        const completedCount = Object.values(localProgress).filter(Boolean).length;
        const percentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

        if (!progressBar || !progressText) return;
        progressBar.style.width = `${percentage}%`;
        progressBar.classList.toggle('bg-green-600', percentage === 100);
        progressBar.classList.toggle('bg-sky-600', percentage < 100);
        progressText.textContent = `${completedCount} de ${totalTopics} tópicos concluídos (${percentage}%)`;
    }

    function applyProgressToUI() {
        checkboxes.forEach(checkbox => {
            checkbox.checked = !!localProgress[checkbox.dataset.key];
        });
        updateProgressBar();
    }

    async function saveProgress() {
        if (!currentUser) return;
        setStatus('Salvando...', 'text-yellow-600');
        try {
            await Api.saveTrailProgress(trilhaId, localProgress);
            setStatus('Progresso salvo na nuvem', 'text-green-600');
        } catch (error) {
            console.error('Erro ao salvar progresso:', error);
            setStatus('Erro ao salvar', 'text-red-600');
        }
    }

    const debouncedSave = (() => {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(saveProgress, 1500);
        };
    })();

    async function loadProgress() {
        if (!currentUser) return;
        setStatus('Carregando...', 'text-gray-500');
        try {
            const saved = await Api.getTrailProgress(trilhaId, currentUser.uid);
            if (Object.keys(saved).length > 0) {
                localProgress = saved;
                applyProgressToUI();
                setStatus('Progresso carregado da nuvem', 'text-green-600');
            } else {
                setStatus('Nenhum progresso salvo na nuvem ainda', 'text-gray-500');
            }
        } catch (error) {
            console.error('Erro ao carregar progresso:', error);
            setStatus('Erro ao carregar progresso', 'text-red-600');
        }
    }

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            localProgress[checkbox.dataset.key] = checkbox.checked;
            updateProgressBar();
            debouncedSave();
        });
    });

    Api.onAuthChange(user => {
        if (user) {
            currentUser = user;
            loadProgress();
        } else {
            currentUser = null;
            // Sem usuário: volta para o login para evitar inconsistências.
            window.location.href = '../SIGAV/login.html';
        }
    });
});
