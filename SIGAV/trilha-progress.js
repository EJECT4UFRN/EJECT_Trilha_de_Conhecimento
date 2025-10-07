(function() {
    'use strict';
    return; // SCRIPT DESATIVADO PARA EVITAR CONFLITO COM salvamento_nuvem.js
    
    // Evita múltiplas cargas
    if (window.__trilha_progress_loaded) return;
    window.__trilha_progress_loaded = true;

    console.log('🚀 Iniciando sistema completo de progresso da trilha...');

    // Configuração
    let trilhaId = null;
    let totalTopics = 0;
    let progressData = {};
    let isFirebaseOnline = false;

    // Utilitários
    const debounce = (fn, delay = 600) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    };

    // Detecta ID da trilha
    function getTrilhaId() {
        const metaName = document.getElementById('trilha-nome')?.value;
        if (metaName) return metaName.toLowerCase().replace(/\s+/g, '_');
        
        const title = document.title.split('|')[1]?.trim();
        if (title) return title.toLowerCase().replace(/\s+/g, '_');
        
        const path = window.location.pathname;
        return path.split('/').pop().replace('.html', '') || 'trilha_desconhecida';
    }

    // Adiciona estilos CSS completos
    function addStyles() {
        if (document.getElementById('trilha-progress-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'trilha-progress-styles';
        style.textContent = `
            .completion-container {
                display: flex;
                align-items: center;
                padding: 0.25rem 0.75rem;
                border-radius: 9999px;
                background-color: #f0f9ff;
                font-size: 0.875rem;
                color: #0284c7;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
                margin-left: 1rem;
                flex-shrink: 0;
            }
            .completion-container:hover {
                background-color: #e0f2fe;
            }
            .topic-checkbox {
                appearance: none;
                width: 1.25rem;
                height: 1.25rem;
                border: 2px solid #38bdf8;
                border-radius: 0.25rem;
                margin-right: 0.5rem;
                display: inline-grid;
                place-content: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            .topic-checkbox::before {
                content: "";
                width: 0.65rem;
                height: 0.65rem;
                transform: scale(0);
                transition: 120ms transform ease-in-out;
                box-shadow: inset 1em 1em #0ea5e9;
                clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 60%);
                background-color: CanvasText;
            }
            .topic-checkbox:checked {
                border-color: #0ea5e9;
                background-color: #f0f9ff;
            }
            .topic-checkbox:checked::before {
                transform: scale(1);
            }
            .completion-label {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                font-size: 0.875rem;
                color: #0369a1; /* Azul mais escuro para o texto */
                cursor: pointer;
                padding: 0.375rem 0.875rem; /* Ajuste no padding */
                border: 1px solid #7dd3fc; /* Borda azul clara */
                border-radius: 9999px;
                background-color: #f0f9ff; /* Fundo azul bem claro */
                transition: background-color 0.2s;
                width: fit-content;
                margin-left: auto;
                user-select: none;
            }
            .completion-label:hover {
                background-color: #e0f2fe;
            }
            .completion-label .topic-checkbox {
                appearance: none;
                width: 1.15rem;
                height: 1.15rem;
                border: 2px solid #38bdf8;
                border-radius: 0.25rem;
                display: inline-grid;
                place-content: center;
                cursor: pointer;
                transition: all 0.2s;
                background-color: white;
            }
            .completion-label .topic-checkbox::before {
                content: "";
                width: 0.65rem;
                height: 0.65rem;
                transform: scale(0);
                transition: 120ms transform ease-in-out;
                box-shadow: inset 1em 1em #0ea5e9; /* Cor do visto */
                clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 60%);
            }
            .completion-label .topic-checkbox:checked {
                border-color: #0ea5e9;
                background-color: #e0f2fe; /* Fundo azul claro quando checado */
            }
            .completion-label .topic-checkbox:checked::before {
                transform: scale(1);
            }
            .completion-label span {
                font-weight: 500;
                color: #0369a1; /* Cor do texto consistente */
            }
            .progress-status-indicator {
                display: inline-flex;
                align-items: center;
                font-size: 0.75rem;
                padding: 0.25rem 0.5rem;
                border-radius: 0.375rem;
                margin-left: 0.5rem;
                font-weight: 500;
            }
            .progress-local {
                background-color: #fef3c7;
                color: #92400e;
            }
            .progress-synced {
                background-color: #d1fae5;
                color: #065f46;
            }
        `;
        document.head.appendChild(style);
    }

    

    // Configura botões da barra de progresso
    function setupProgressButtons() {
        const syncBtn = document.getElementById('syncProgress');

        if (syncBtn) {
            syncBtn.addEventListener('click', forceSyncProgress);
        }
    }

    // Força sincronização
    async function forceSyncProgress() {
        const btn = document.getElementById('syncProgress');
        if (btn) btn.textContent = '⏳ Sync...';
        
        if (isFirebaseOnline && window.firebase?.auth?.currentUser) {
            await loadProgressFromFirebase();
        } else {
        }
        
        if (btn) btn.textContent = '🔄 Sync';
    }

    // Reset progresso
    function resetAllProgress() {
        if (confirm('Tem certeza que deseja resetar todo o progresso? Esta ação não pode ser desfeita.')) {
            progressData = {};
            
            // Limpa localStorage
            try {
                localStorage.removeItem(`trilha_progress_${trilhaId}`);
            } catch (e) {
                console.warn('Erro ao limpar localStorage:', e);
            }
            
            // Limpa Firebase se online
            if (isFirebaseOnline && window.firebase?.auth?.currentUser) {
                const user = firebase.auth().currentUser;
                const db = firebase.firestore();
                const docRef = db.collection('user_progress').doc(user.uid).collection('trilhas').doc(trilhaId);
                
                docRef.delete().then(() => {
                    console.log('🗑️ Progresso removido do Firebase');
                }).catch(err => {
                    console.error('Erro ao remover do Firebase:', err);
                });
            }
            
            // Atualiza UI
            applyProgressToCheckboxes();
            updateProgressBar();
            updateProgressStatus('local');
            
            console.log('🗑️ Progresso resetado');
        }
    }

    // Exporta dados do progresso
    function exportProgressData() {
        const data = {
            trilhaId: trilhaId,
            trilhaNome: document.getElementById('trilha-nome')?.value || 'Trilha Desconhecida',
            progresso: progressData,
            totalTopicos: totalTopics,
            completados: Object.values(progressData).filter(Boolean).length,
            percentual: totalTopics > 0 ? Math.round((Object.values(progressData).filter(Boolean).length / totalTopics) * 100) : 0,
            exportadoEm: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progresso_${trilhaId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📄 Progresso exportado');
    }

    // Atualiza status visual
    function updateProgressStatus(status) {
        const statusEl = document.getElementById('progressStatus');
        if (!statusEl) return;
        
        if (status === 'synced') {
            statusEl.className = 'progress-status-indicator progress-synced';
            statusEl.textContent = '☁️ Sincronizado';
        } else {
            statusEl.className = 'progress-status-indicator progress-local';
            statusEl.textContent = '💾 Local';
        }
    }

    // Atualiza barra de progresso
    function updateProgressBar() {
        const completed = Object.values(progressData).filter(Boolean).length;
        const percentage = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0;
        
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.className = `h-4 rounded-full transition-all duration-500 ease-in-out ${
                percentage < 100 ? 'bg-sky-600' : 'bg-green-600'
            }`;
        }
        
        if (progressText) {
            progressText.textContent = `${percentage}% Concluído (${completed}/${totalTopics})`;
        }
    }

    // Salva progresso (localStorage + Firebase)
    const saveProgress = debounce((key, checked) => {
        progressData[key] = checked;
        
        // Salva localmente sempre
        try {
            localStorage.setItem(`trilha_progress_${trilhaId}`, JSON.stringify(progressData));
            console.log(`💾 Salvo localmente: ${key} = ${checked}`);
            updateProgressStatus('local');
        } catch (e) {
            console.warn('Erro ao salvar no localStorage:', e);
        }
        
        // Salva no Firebase se disponível
        if (isFirebaseOnline && window.firebase?.auth?.currentUser) {
            const user = firebase.auth().currentUser;
            const db = firebase.firestore();
            const docRef = db.collection('user_progress').doc(user.uid).collection('trilhas').doc(trilhaId);
            
            const payload = {
                progress: progressData,
                trilhaId: trilhaId,
                trilhaNome: document.getElementById('trilha-nome')?.value || 'Trilha Desconhecida',
                totalTopics: totalTopics,
                completedCount: Object.values(progressData).filter(Boolean).length,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            docRef.set(payload, { merge: true }).then(() => {
                console.log(`☁️ Salvo no Firebase: ${key} = ${checked}`);
                updateProgressStatus('synced');
            }).catch(err => {
                console.error('Erro ao salvar no Firebase:', err);
                updateProgressStatus('local');
            });
        }
        
        updateProgressBar();
    });

    // Carrega progresso do Firebase
    async function loadProgressFromFirebase() {
        if (!isFirebaseOnline || !window.firebase?.auth?.currentUser) return false;
        
        try {
            const user = firebase.auth().currentUser;
            const db = firebase.firestore();
            const doc = await db.collection('user_progress').doc(user.uid).collection('trilhas').doc(trilhaId).get();
            
            if (doc.exists) {
                const data = doc.data();
                if (data.progress) {
                    progressData = { ...progressData, ...data.progress };
                    
                    // Salva localmente a versão sincronizada
                    localStorage.setItem(`trilha_progress_${trilhaId}`, JSON.stringify(progressData));
                    console.log('☁️ Progresso sincronizado do Firebase');
                    return true;
                }
            }
        } catch (e) {
            console.warn('Erro ao sincronizar Firebase:', e);
        }
        
        return false;
    }

    // Carrega progresso (localStorage + Firebase)
    async function loadProgress() {
        // Carrega do localStorage primeiro
        try {
            const saved = localStorage.getItem(`trilha_progress_${trilhaId}`);
            if (saved) {
                progressData = JSON.parse(saved);
                console.log('💾 Progresso carregado do localStorage');
                updateProgressStatus('local');
            }
        } catch (e) {
            progressData = {};
        }
        
        // Tenta sincronizar com Firebase
        const synced = await loadProgressFromFirebase();
        if (synced) {
            updateProgressStatus('synced');
        }
        
        // Aplica aos checkboxes
        applyProgressToCheckboxes();
        updateProgressBar();
    }

    // Aplica progresso aos checkboxes existentes
    function applyProgressToCheckboxes() {
        const checkboxes = document.querySelectorAll('.topic-checkbox[data-key]');
        checkboxes.forEach(cb => {
            const key = cb.dataset.key;
            cb.checked = !!progressData[key];
            
            // Adiciona listener se não tem
            if (!cb.hasAttribute('data-progress-listener')) {
                cb.addEventListener('change', (e) => {
                    saveProgress(e.target.dataset.key, e.target.checked);
                });
                cb.setAttribute('data-progress-listener', 'true');
            }
        });
    }

    // Conta total de tópicos
    function countTopics() {
        const checkboxes = document.querySelectorAll('.topic-checkbox[data-key]');
        totalTopics = checkboxes.length;
        console.log(`📚 ${totalTopics} tópicos encontrados na trilha: ${trilhaId}`);
        
        // Atualiza texto da barra se já existe
        const progressText = document.getElementById('progressText');
        if (progressText) {
            const completed = Object.values(progressData).filter(Boolean).length;
            const percentage = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0;
            progressText.textContent = `${percentage}% Concluído (${completed}/${totalTopics})`;
        }
    }

    // Verifica conectividade Firebase
    function checkFirebaseConnection() {
        if (window.firebase && firebase.auth && firebase.firestore) {
            isFirebaseOnline = true;
            console.log('☁️ Firebase disponível');
            
            // Observer de auth
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    console.log(`👤 Usuário logado: ${user.uid}`);
                    loadProgress(); // Recarrega com dados do Firebase
                } else {
                    console.log('🔒 Usuário deslogado - progresso apenas local');
                    updateProgressStatus('local');
                    loadProgress(); // Carrega dados locais
                }
            });
        } else {
            isFirebaseOnline = false;
            console.log('💾 Firebase indisponível - progresso apenas local');
            updateProgressStatus('local');
            loadProgress();
        }
    }

    // Função para criar a barra de progresso (estava em falta)
function createProgressBar(progressPercentage) {
    console.log(`📊 Criando barra de progresso: ${progressPercentage}%`);
    
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressStatus = document.getElementById('progress-status');
    
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
    }
    
    if (progressText) {
        const totalTopics = document.querySelectorAll('.topic-checkbox').length;
        const completedTopics = Math.round((progressPercentage / 100) * totalTopics);
        progressText.textContent = `${completedTopics} de ${totalTopics} tópicos concluídos (${progressPercentage}%)`;
    }
    
    if (progressStatus) {
        if (progressPercentage === 100) {
            progressStatus.textContent = "🎉 Trilha Concluída!";
            progressStatus.className = "text-sm font-medium text-green-600";
        } else if (progressPercentage >= 75) {
            progressStatus.textContent = "🔥 Quase lá!";
            progressStatus.className = "text-sm font-medium text-orange-600";
        } else if (progressPercentage >= 50) {
            progressStatus.textContent = "💪 Bom progresso!";
            progressStatus.className = "text-sm font-medium text-blue-600";
        } else if (progressPercentage > 0) {
            progressStatus.textContent = "🚀 Começando bem!";
            progressStatus.className = "text-sm font-medium text-purple-600";
        } else {
            progressStatus.textContent = "📚 Pronto para começar!";
            progressStatus.className = "text-sm font-medium text-gray-600";
        }
    }
}

// Corrigir a função de inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando sistema completo de progresso da trilha...');
    
    // Aguardar o Firebase estar disponível
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase não está disponível ainda, tentando novamente...');
        setTimeout(() => init(), 1000);
        return;
    }
    
    init();
});

function init() {
    try {
        console.log('🔧 Inicializando sistema...');
        
        // Verificar se todas as funções necessárias existem
        if (typeof createProgressBar !== 'function') {
            console.error('❌ Função createProgressBar não encontrada');
            return;
        }
        
        // Detecta trilha
        trilhaId = getTrilhaId();
        console.log(`📋 Trilha identificada: ${trilhaId}`);
        
        // Adiciona estilos
        addStyles();
        
        // Conta tópicos
        countTopics();
        
        // Cria barra de progresso com botões
        createProgressBar();
        
        // Verifica Firebase e carrega dados
        checkFirebaseConnection();
        
        console.log('✅ Sistema completo de progresso inicializado');
        
    } catch (error) {
        console.error(' ❌ Erro na inicialização:', error);
    }
}

// Auto-inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 500); // Delay para aguardar Firebase
}

})();
