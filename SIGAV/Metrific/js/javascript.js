// CÓDIGO 100% COMPLETO E FINAL PARA JS/JAVASCRIPT.JS

window.addEventListener('DOMContentLoaded', function() {
    // --- CONSTANTES E CONFIGURAÇÕES ---
    const firebaseConfig = {
  apiKey: "AIzaSyB-zeXK4JER42k1SlVrxrLhsWbG-LqGn-I",
  authDomain: "metrific.firebaseapp.com",
  projectId: "metrific",
  storageBucket: "metrific.firebasestorage.app",
  messagingSenderId: "282457606307",
  appId: "1:282457606307:web:7aa3e924a03095ab8d9716",
  measurementId: "G-3BB07ELJ29"
};
    const USERS_COLLECTION = 'users';
    const SECTORS_COLLECTION = 'metrific_sectors';
    const TEAMS_COLLECTION = 'metrific_teams';
    const OKRS_COLLECTION = 'metrific_okrs';
    const SUPER_ADMIN_EMAIL = "admin@metrific.com";

    // --- INICIALIZAÇÃO DO FIREBASE ---
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- ESTADO GLOBAL ---
    let currentUserData = null, allUsers = [], allSectors = [], allTeams = [], allOkrs = [], selectedOkrId = null, unsubscribeListeners = [];

    // --- ELEMENTOS DA UI ---
    const loginView = document.getElementById('login-view'), signupView = document.getElementById('signup-view'), appView = document.getElementById('app-view'), mainContent = document.getElementById('main-content');

    // --- HELPERS ---
    const showLoading = (show) => { document.getElementById('loading-spinner').style.display = show ? 'flex' : 'none'; };
    const showToast = (message, isError = false) => {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed bottom-5 right-5 p-4 rounded-lg shadow-lg text-white ${isError ? 'bg-red-500' : 'bg-green-500'} z-50`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    };
    const showConfirmationModal = (message, onConfirm) => {
        const modal = document.getElementById('confirmation-modal');
        const confirmBtn = document.getElementById('confirmation-modal-confirm');
        const cancelBtn = document.getElementById('confirmation-modal-cancel');
        const messageEl = document.getElementById('confirmation-modal-message');

        messageEl.textContent = message;

        // Para evitar múltiplos listeners, removemos os antigos antes de adicionar novos.
        // Uma forma de fazer isso é substituindo o botão por um clone dele mesmo.
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const confirmHandler = () => {
            onConfirm();
            modal.style.display = 'none';
        };

        const cancelHandler = () => {
            modal.style.display = 'none';
        };

        newConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        cancelBtn.addEventListener('click', cancelHandler, { once: true });
        modal.style.display = 'flex';
    };

    // --- FUNÇÕES DE DESINSCRIÇÃO DE LISTENERS ---
    function unsubscribeAll() { 
        unsubscribeListeners.forEach(unsub => unsub()); 
        unsubscribeListeners = []; 
    }

    // --- AUTENTICAÇÃO E INICIALIZAÇÃO ---
    auth.onAuthStateChanged(async (user) => {
        showLoading(true);
        unsubscribeAll();
        if (user) {
            const userDoc = await db.collection(USERS_COLLECTION).doc(user.uid).get();
            if (userDoc.exists) {
                currentUserData = { id: user.uid, ...userDoc.data() };
                showAppView();
                setupRealtimeListeners();
            } else { await auth.signOut(); }
        } else { showLoginView(); }
        showLoading(false);
    });

    function setupAppUI() {
        if (!currentUserData) return;
        document.getElementById('user-name').textContent = currentUserData.name;
        const userInitials = (currentUserData.name[0] || '') + (currentUserData.name.split(' ').pop()?.[0] || '');
        document.getElementById('user-initials').textContent = userInitials.toUpperCase();
        const userTeam = allTeams.find(t => t.id === currentUserData.teamId);
        document.getElementById('user-team').textContent = userTeam?.name || 'Sem equipe';
        document.querySelectorAll('.admin-only').forEach(el => { el.style.display = currentUserData.role === 'admin' ? 'flex' : 'none'; });
    }

    function showLoginView() { appView.style.display = 'none'; loginView.style.display = 'flex'; signupView.style.display = 'none'; }
    function showAppView() { loginView.style.display = 'none'; signupView.style.display = 'none'; appView.style.display = 'block'; setupNavigation(); }

    const registerUser = async (name, email, password) => {
        showLoading(true);
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection(USERS_COLLECTION).doc(userCredential.user.uid).set({ name, email, role: 'colaborador', canEditOKRs: false, teamId: null, sectorId: null, status: 'active' });
            showToast('Conta criada com sucesso!');
            signupView.classList.add('hidden');
            loginView.classList.remove('hidden');
        } catch (error) { showToast(error.message, true); }
        finally { showLoading(false); }
    };
    const loginUser = async (email, password) => {
        showLoading(true);
        try { await auth.signInWithEmailAndPassword(email, password); }
        catch (error) { showToast('Email ou senha inválidos.', true); }
        finally { showLoading(false); }
    };
    const logoutUser = async () => {
        try { await auth.signOut(); showToast('Logout realizado com sucesso.'); }
        catch (error) { showToast('Erro ao sair.', true); }
    };

    // --- GESTÃO E ATUALIZAÇÃO DE VIEWS ---
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('nav-active'));
                link.classList.add('nav-active');
                const viewName = link.getAttribute('data-view');
                
                // Hide all views before showing the selected one
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                const targetView = document.getElementById(`${viewName}-content`);
                if (targetView) targetView.classList.remove('hidden');
                
                // Render the view content
                renderCurrentView();
            });
        });
        
        // Activate dashboard by default if no active link
        if (!document.querySelector('.nav-link.nav-active')) {
            document.querySelector('.nav-link[data-view="dashboard"]').classList.add('nav-active');
            document.getElementById('dashboard-content').classList.remove('hidden');
        }
        
        // Initial render
        renderCurrentView();
    }
    
    function renderCurrentView() {
        if (!currentUserData) return;
        const activeLink = document.querySelector('.nav-link.nav-active');
        if (!activeLink) return;
        const viewToRender = activeLink.getAttribute('data-view');
        switch(viewToRender) {
            case 'dashboard': renderDashboard(); break;
            case 'okrs': renderOkrList(); break;
            case 'teams': renderTeamsAndSectors(); break;
            case 'users': if (currentUserData.role === 'admin') renderUsers(); break;
        }
    }
    
    // --- LISTENERS DO FIREBASE ---
    function setupRealtimeListeners() {
        unsubscribeAll();
        let listeners = [];
        const onError = (e, c) => console.error(`Erro no listener: ${c}`, e);
        
        listeners.push(db.collection(SECTORS_COLLECTION).onSnapshot(s => { 
            allSectors = s.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderCurrentView(); 
        }, e => onError(e, 'Setores')));
        
        listeners.push(db.collection(TEAMS_COLLECTION).onSnapshot(s => { 
            allTeams = s.docs.map(d => ({ id: d.id, ...d.data() })); 
            setupAppUI(); 
            renderCurrentView(); 
        }, e => onError(e, 'Equipes')));
        
        if (currentUserData.role === 'admin') {
            listeners.push(db.collection(USERS_COLLECTION).onSnapshot(s => { 
                allUsers = s.docs.map(d => ({ id: d.id, ...d.data() })); 
                renderCurrentView(); 
            }, e => onError(e, 'Usuários')));
            
            listeners.push(db.collection(OKRS_COLLECTION).onSnapshot(s => { 
                allOkrs = s.docs.map(d => ({ id: d.id, ...d.data() })); 
                renderCurrentView(); 
            }, e => onError(e, 'OKRs')));
        } else {
            allUsers = [currentUserData];
            if (currentUserData.teamId) {
                listeners.push(db.collection(OKRS_COLLECTION).where('responsibleTeamId', '==', currentUserData.teamId).onSnapshot(s => { 
                    allOkrs = s.docs.map(d => ({ id: d.id, ...d.data() })); 
                    renderCurrentView(); 
                }, e => onError(e, 'OKRs da equipe')));
            }
            renderCurrentView();
        }
        unsubscribeListeners = listeners;
    }
    
    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderDashboard() {
        const container = document.getElementById('dashboard-content');
        const okrsToDisplay = (currentUserData.role === 'admin') ? allOkrs : allOkrs.filter(okr => okr.responsibleTeamId === currentUserData.teamId);
        const totalOkrs = okrsToDisplay.length;
        let achievedOkrs = 0;
        let totalProgress = 0;
        
        okrsToDisplay.forEach(okr => { 
            const progress = calculateOkrProgress(okr.keyResults || []); 
            totalProgress += progress; 
            if (progress >= 100) achievedOkrs++; 
        });
        
        const avgProgress = totalOkrs > 0 ? (totalProgress / totalOkrs) : 0;
        
        container.innerHTML = `
            <h2 class="text-3xl font-bold text-slate-800">Bem-vindo(a), ${currentUserData.name.split(' ')[0]}!</h2>
            <p class="text-slate-500 mt-1 mb-8">Este é o seu resumo de performance.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-5 rounded-xl shadow-md flex items-center">
                    <div class="p-4 rounded-full bg-blue-100">
                        <i class="ph-target text-2xl text-blue-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-slate-500 text-sm">Objetivos Ativos</p>
                        <p class="text-2xl font-bold text-slate-800">${totalOkrs}</p>
                    </div>
                </div>
                
                <div class="bg-white p-5 rounded-xl shadow-md flex items-center">
                    <div class="p-4 rounded-full bg-green-100">
                        <i class="ph-check-circle text-2xl text-green-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-slate-500 text-sm">Concluídos</p>
                        <p class="text-2xl font-bold text-slate-800">${achievedOkrs}</p>
                    </div>
                </div>
                
                <div class="bg-white p-5 rounded-xl shadow-md flex items-center">
                    <div class="p-4 rounded-full bg-yellow-100">
                        <i class="ph-chart-pie-slice text-2xl text-yellow-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-slate-500 text-sm">Progresso Médio</p>
                        <p class="text-2xl font-bold text-slate-800">${avgProgress.toFixed(0)}%</p>
                    </div>
                </div>
                
                <div class="bg-white p-5 rounded-xl shadow-md flex items-center">
                    <div class="p-4 rounded-full bg-indigo-100">
                        <i class="ph-users text-2xl text-indigo-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-slate-500 text-sm">Total de Usuários</p>
                        <p class="text-2xl font-bold text-slate-800">${allUsers.length}</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-md">
                <h3 class="text-xl font-bold text-slate-800 mb-4">Progresso Geral dos Objetivos</h3>
                <div class="space-y-4">
                    ${okrsToDisplay.length === 0 ? 
                        '<p class="text-slate-500 text-center py-4">Nenhum OKR para exibir.</p>' : 
                        okrsToDisplay.map(okr => {
                            const progress = calculateOkrProgress(okr.keyResults || []);
                            const team = allTeams.find(t => t.id === okr.responsibleTeamId);
                            return `
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <p class="font-semibold text-slate-700">
                                            ${okr.title || okr.objective} 
                                            <span class="font-normal text-xs text-purple-600">
                                                (${team?.name || 'N/A'})
                                            </span>
                                        </p>
                                        <p class="font-semibold text-sm text-indigo-700">${progress.toFixed(0)}%</p>
                                    </div>
                                    <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                        <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${progress}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
    }

    function renderOkrList() {
        const listContainer = document.getElementById('okrs-list');
        const actionsContainer = document.getElementById('okrs-actions');
        if (!listContainer || !actionsContainer) return;
        
        const okrsToRender = currentUserData.role === 'admin' ? allOkrs : allOkrs.filter(o => o.responsibleTeamId === currentUserData.teamId);
        const canCreate = currentUserData.role === 'admin' || currentUserData.canEditOKRs;
        const selectedOkr = selectedOkrId ? okrsToRender.find(okr => okr.id === selectedOkrId) : null;
        const canUpdateSelectedOkr = selectedOkr && canCreate;
        const canEditSelectedOkr = selectedOkr && (currentUserData.role === 'admin' || (currentUserData.canEditOKRs && currentUserData.teamId === selectedOkr.responsibleTeamId));
        
        actionsContainer.innerHTML = `
            <button data-action="export-pdf" class="btn-secondary font-semibold py-2 px-4 rounded-lg flex items-center text-sm">
                <i class="ph-file-pdf text-lg mr-2"></i>Exportar PDF
            </button>
            <button data-action="export-csv" class="btn-secondary font-semibold py-2 px-4 rounded-lg flex items-center text-sm">
                <i class="ph-table text-lg mr-2"></i>Exportar Planilha
            </button>
            ${canEditSelectedOkr ? `
                <button data-action="edit-okr" data-id="${selectedOkrId}" class="btn-secondary font-semibold py-2 px-4 rounded-lg flex items-center text-sm">
                    <i class="ph-pencil-simple text-lg mr-2"></i>Editar OKR
                </button>
                <button data-action="delete-okr" data-id="${selectedOkrId}" class="btn-secondary font-semibold py-2 px-4 rounded-lg flex items-center text-sm text-red-600 hover:bg-red-50">
                    <i class="ph-trash text-lg mr-2"></i>Excluir OKR
                </button>
            ` : ''}
            <button data-action="update-okr" class="btn-primary font-semibold py-2 px-4 rounded-lg items-center text-sm" 
                    style="display: ${canUpdateSelectedOkr ? 'flex' : 'none'};">
                <i class="ph-arrow-clockwise text-lg mr-2"></i>Atualizar OKR
            </button>
            <button data-action="add-okr" class="btn-primary font-semibold py-2 px-4 rounded-lg flex items-center text-sm" 
                    style="display: ${canCreate ? 'flex' : 'none'}">
                <i class="ph-plus-circle text-lg mr-2"></i>Novo Objetivo
            </button>
        `;

        listContainer.innerHTML = okrsToRender.length === 0 
            ? `<div class="text-center py-10 px-6 bg-white rounded-xl shadow-md col-span-full">
                <i class="ph-binoculars text-6xl text-slate-400"></i>
                <h3 class="mt-4 text-xl font-bold text-slate-700">Nenhum Objetivo Encontrado</h3>
                <p class="mt-2 text-slate-500">Clique em "Novo Objetivo" para começar.</p>
               </div>` 
            : okrsToRender.map(okr => { 
                const progress = calculateOkrProgress(okr.keyResults || []); 
                const team = allTeams.find(t => t.id === okr.responsibleTeamId); 
                const canEdit = currentUserData.role === 'admin' || (currentUserData.canEditOKRs && currentUserData.teamId === okr.responsibleTeamId); 
                
                return `
                    <div class="okr-card bg-white rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg flex flex-col cursor-pointer border-2 ${selectedOkrId === okr.id ? 'selected border-indigo-500' : 'border-transparent'}" 
                         data-action="select-okr" data-id="${okr.id}">
                        <div class="p-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        ${team?.name || 'N/A'} • ${okr.period || 'N/A'}
                                    </p>
                                    <h3 class="text-xl font-bold text-slate-800 mt-1">
                                        ${okr.title || okr.objective}
                                    </h3>
                                </div>
                                <div class="flex items-center space-x-1">
                                    <p class="font-bold text-2xl text-slate-800">${progress.toFixed(0)}%</p>
                                    ${canEdit ? `
                                        <div class="flex">
                                            <button data-action="edit-okr" data-id="${okr.id}" class="edit-okr-btn p-2 rounded-full text-slate-500 hover:bg-slate-200">
                                                <i class="ph-pencil-simple text-xl"></i>
                                            </button>
                                            <button data-action="delete-okr" data-id="${okr.id}" class="delete-okr-btn p-2 rounded-full text-slate-500 hover:bg-red-100">
                                                <i class="ph-trash text-xl"></i>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-3 mt-4 overflow-hidden">
                                <div class="bg-indigo-600 h-3 rounded-full" style="width: ${progress}%"></div>
                            </div>
                        </div>
                        <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex-grow">
                            <h4 class="font-semibold text-slate-700 mb-3">Resultados-Chave</h4>
                            <div class="space-y-4">
                                ${(okr.keyResults || []).map(kr => { 
                                    const krProgress = calculateKrProgress(kr); 
                                    return `
                                        <div class="kr-item">
                                            <p class="font-medium text-slate-800">${kr.indicator || kr.title}</p>
                                            <div class="flex items-center justify-between mt-1">
                                                <div class="w-full bg-slate-200 rounded-full h-2 mr-4 overflow-hidden">
                                                    <div class="h-2 rounded-full ${getKRProgressColor(kr)}" 
                                                         style="width: ${krProgress}%"></div>
                                                </div>
                                                <p class="text-sm font-mono text-slate-600 w-28 text-right">
                                                    ${kr.currentValue} / ${kr.targetValue} ${kr.unit || ''}
                                                </p>
                                            </div>
                                        </div>
                                    `;
                                }).join('') || '<p class="text-slate-500 text-sm">Nenhum resultado-chave.</p>'}
                            </div>
                        </div>
                        ${(okr.history && okr.history.length > 0) ? `
                            <div class="border-t border-slate-200">
                                <button type="button" data-action="toggle-history" class="w-full text-left p-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 flex justify-between items-center">
                                    <span>Ver Histórico (${okr.history.length})</span>
                                    <i class="ph-caret-down text-base transition-transform"></i>
                                </button>
                                <div class="history-details bg-slate-50 p-4 hidden space-y-3 text-sm">
                                    ${okr.history.slice().reverse().map(entry => `
                                        <div class="border-b border-slate-200 pb-2 last:border-b-0">
                                            <p><strong>${entry.updatedBy}</strong> em ${new Date(entry.updatedAt).toLocaleString('pt-BR')}</p>
                                            <p class="text-slate-600 mt-1 italic">"${entry.comment}"</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
        // Adicionar esta linha após a renderização para garantir que os botões de histórico funcionem
        setTimeout(() => {
            setupHistoryToggleButtons();
        }, 0);
    }

    // Adicionar esta nova função para garantir que os botões de histórico funcionem
    function setupHistoryToggleButtons() {
        document.querySelectorAll('[data-action="toggle-history"]').forEach(button => {
            button.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const historyIcon = this.querySelector('i');
                if (historyIcon) historyIcon.classList.toggle('rotate-180');
                
                const historyDetails = this.nextElementSibling;
                if (historyDetails) historyDetails.classList.toggle('hidden');
            };
        });
    }
    
    // Adicionar a função renderTeamsAndSectors que está faltando
    function renderTeamsAndSectors() {
        const container = document.getElementById('teams-content');
        const actionsContainer = document.getElementById('teams-actions');
        
        if (!container) return;
        
        // Configurar botões de ação (visíveis apenas para admin)
        if (actionsContainer) {
            actionsContainer.innerHTML = currentUserData.role === 'admin' ? `
                <button data-action="add-sector" class="btn-secondary font-semibold py-2 px-4 rounded-lg flex items-center text-sm">
                    <i class="ph-folder-simple-plus text-lg mr-2"></i>Novo Setor
                </button>
                <button data-action="add-team" class="btn-primary font-semibold py-2 px-4 rounded-lg flex items-center text-sm">
                    <i class="ph-users-plus text-lg mr-2"></i>Nova Equipe
                </button>
            ` : '';
        }
        
        // Renderizar lista de setores e equipes
        const teamsListContainer = container.querySelector('#teams-list-container');
        if (!teamsListContainer) return;
        
        if (allSectors.length === 0) {
            teamsListContainer.innerHTML = `
                <div class="text-center py-10 px-6 bg-white rounded-xl shadow-md col-span-full">
                    <i class="ph-folders text-6xl text-slate-400"></i>
                    <h3 class="mt-4 text-xl font-bold text-slate-700">Nenhum Setor Cadastrado</h3>
                    <p class="mt-2 text-slate-500">Clique em "Novo Setor" para começar.</p>
                </div>
            `;
            return;
        }
        
        teamsListContainer.innerHTML = allSectors.map(sector => {
            const isAdmin = currentUserData.role === 'admin';
            const sectorTeams = allTeams.filter(t => t.sectorId === sector.id);
            
            return `
                <div class="bg-white p-6 rounded-xl shadow-md">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-slate-800 flex items-center">
                            <i class="ph-folder-simple text-xl mr-3 text-indigo-600"></i>${sector.name}
                        </h3>
                        ${isAdmin ? `
                            <div class="flex space-x-2">
                                <button data-action="edit-sector" data-id="${sector.id}" class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex items-center">
                                    <i class="ph-pencil-simple text-lg mr-1"></i>
                                    <span class="text-sm">Editar</span>
                                </button>
                                <button data-action="delete-sector" data-id="${sector.id}" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center">
                                    <i class="ph-trash text-lg mr-1"></i>
                                    <span class="text-sm">Excluir</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="divide-y divide-slate-200">
                        ${sectorTeams.length > 0 ? sectorTeams.map(team => `
                            <div class="py-3 flex justify-between items-center">
                                <p class="text-slate-700 font-medium">${team.name}</p>
                                ${isAdmin ? `
                                    <div class="flex space-x-2">
                                        <button data-action="edit-team" data-id="${team.id}" class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex items-center">
                                            <i class="ph-pencil-simple text-lg mr-1"></i>
                                            <span class="text-sm">Editar</span>
                                        </button>
                                        <button data-action="delete-team" data-id="${team.id}" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center">
                                            <i class="ph-trash text-lg mr-1"></i>
                                            <span class="text-sm">Excluir</span>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') : '<p class="text-slate-500 text-sm py-3">Nenhuma equipe neste setor.</p>'}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function renderUsers() {
        const container = document.getElementById('users-content');
        if (!container || currentUserData.role !== 'admin') return;
        
        const tableBody = container.querySelector('#users-table-body');
        if (!tableBody) return;
        
        if (allUsers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4">Nenhum usuário encontrado.</td></tr>`;
            return;
        }
        
        tableBody.innerHTML = allUsers
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(user => {
                const team = allTeams.find(t => t.id === user.teamId);
                const isAdmin = user.role === 'admin';
                const canEditClass = user.canEditOKRs ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                
                return `
                    <tr class="bg-white border-b hover:bg-slate-50">
                        <td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                            ${user.name}
                            <br>
                            <span class="text-xs text-slate-500">${user.email}</span>
                        </td>
                        <td class="px-6 py-4">${team ? team.name : 'Sem equipe'}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${canEditClass}">
                                ${user.canEditOKRs ? 'Sim' : 'Não'}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                            ${user.email !== SUPER_ADMIN_EMAIL ? `
                                <button data-action="edit-user" data-id="${user.id}" class="font-medium text-indigo-600 hover:underline mr-4">
                                    Editar
                                </button>
                                <button data-action="delete-user" data-id="${user.id}" class="font-medium text-red-600 hover:underline">
                                    Excluir
                                </button>
                            ` : '<span class="italic text-slate-400">Super Admin</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
    }
    
    // --- FUNÇÕES DE EXPORTAÇÃO ---
    function exportToPdf() {
        showLoading(true);
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Definir título do documento
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59); // text-slate-800
            doc.text('Relatório de OKRs - Metrific', 15, 15);
            
            // Adicionar data de geração
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // text-slate-500
            const today = new Date().toLocaleDateString('pt-BR');
            doc.text(`Gerado em: ${today} por ${currentUserData.name}`, 15, 22);
            
            // Listar OKRs
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Lista de Objetivos e Resultados-Chave:', 15, 30);
            
            // Selecionar OKRs para exportar (todos ou apenas o selecionado)
            const okrsToExport = selectedOkrId 
                ? [allOkrs.find(o => o.id === selectedOkrId)].filter(Boolean) 
                : (currentUserData.role === 'admin' ? allOkrs : allOkrs.filter(o => o.responsibleTeamId === currentUserData.teamId));
            
            // Variável para controlar a posição Y no PDF
            let yPos = 40;
            const pageHeight = doc.internal.pageSize.height;
            
            // Renderizar cada OKR
            okrsToExport.forEach((okr, index) => {
                // Verificar se precisa adicionar nova página
                if (yPos > pageHeight - 40) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const progress = calculateOkrProgress(okr.keyResults || []);
                const team = allTeams.find(t => t.id === okr.responsibleTeamId);
                
                // Título do OKR
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text(`${index + 1}. ${okr.title || okr.objective}`, 15, yPos);
                yPos += 6;
                
                // Informações do OKR
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`Equipe: ${team?.name || 'N/A'}  |  Período: ${okr.period || 'N/A'}  |  Progresso: ${progress.toFixed(0)}%`, 15, yPos);
                yPos += 6;
                
                // Desenhar barra de progresso
                const barWidth = 100;
                const progressWidth = (progress / 100) * barWidth;
                
                // Fundo da barra
                doc.setDrawColor(226, 232, 240); // bg-slate-200
                doc.setFillColor(226, 232, 240);
                doc.roundedRect(15, yPos, barWidth, 3, 1.5, 1.5, 'FD');
                
                // Barra de progresso
                doc.setDrawColor(79, 70, 229); // bg-indigo-600
                doc.setFillColor(79, 70, 229);
                if (progressWidth > 0) {
                    doc.roundedRect(15, yPos, progressWidth, 3, 1.5, 1.5, 'FD');
                }
                yPos += 7;
                
                // Descrição se existir
                if (okr.description) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139);
                    
                    // Quebrar texto longo em múltiplas linhas
                    const splitDescription = doc.splitTextToSize(okr.description, 180);
                    doc.text(splitDescription, 15, yPos);
                    yPos += splitDescription.length * 4 + 3;
                }
                
                // Título dos Key Results
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text('Resultados-Chave:', 15, yPos);
                yPos += 5;
                
                // Listar Key Results
                if (okr.keyResults && okr.keyResults.length > 0) {
                    okr.keyResults.forEach((kr, krIndex) => {
                        // Verificar se precisa adicionar nova página
                        if (yPos > pageHeight - 30) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        const krProgress = calculateKrProgress(kr);
                        
                        // Nome do KR
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(9);
                        doc.setTextColor(30, 41, 59);
                        doc.text(`${index + 1}.${krIndex + 1} ${kr.indicator || kr.title}`, 20, yPos);
                        yPos += 4;
                        
                        // Valores do KR
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);
                        doc.setTextColor(100, 116, 139);
                        doc.text(`Atual: ${kr.currentValue} | Meta: ${kr.targetValue} ${kr.unit || ''} | Progresso: ${krProgress.toFixed(0)}%`, 25, yPos);
                        yPos += 6;
                    });
                } else {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139);
                    doc.text('Nenhum resultado-chave definido.', 20, yPos);
                    yPos += 6;
                }
                
                // NOVO: Adicionar histórico de observações
                if (okr.history && okr.history.length > 0) {
                    yPos += 5;
                    
                    // Verificar se precisa adicionar nova página
                    if (yPos > pageHeight - 30) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Título do histórico
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(30, 41, 59);
                    doc.text('Histórico de Observações:', 15, yPos);
                    yPos += 5;
                    
                    // Ordenar o histórico do mais recente para o mais antigo
                    const sortedHistory = [...okr.history].reverse();
                    
                    // Listar observações
                    sortedHistory.forEach((entry, entryIndex) => {
                        // Verificar se precisa adicionar nova página
                        if (yPos > pageHeight - 35) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        const formattedDate = new Date(entry.updatedAt).toLocaleDateString('pt-BR');
                        const formattedTime = new Date(entry.updatedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                        
                        // Cabeçalho da observação
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(79, 70, 229); // indigo
                        doc.text(`${entryIndex + 1}. ${entry.updatedBy} em ${formattedDate} às ${formattedTime}:`, 20, yPos);
                        yPos += 4;
                        
                        // Conteúdo da observação
                        doc.setFont('helvetica', 'italic');
                        doc.setFontSize(8);
                        doc.setTextColor(100, 116, 139);
                        
                        // Quebrar o comentário em múltiplas linhas
                        const splitComment = doc.splitTextToSize(`"${entry.comment}"`, 170);
                        doc.text(splitComment, 25, yPos);
                        yPos += splitComment.length * 3.5 + 2;
                    });
                }
                
                // Espaço entre OKRs
                yPos += 10;
            });
            
            // Adicionar rodapé
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184); // text-slate-400
                doc.text(`Metrific - Sistema de OKR | Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
            }
            
            // Salvar o PDF
            const fileName = selectedOkrId ? 'metrific-okr.pdf' : 'metrific-todos-okrs.pdf';
            doc.save(fileName);
            
            showToast('Relatório PDF gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showToast('Erro ao gerar o relatório PDF.', true);
        } finally {
            showLoading(false);
        }
    }
    
    // --- EXPORTAÇÃO CSV ---
    function exportToCsv() {
        showLoading(true);
        
        try {
            // Selecionar OKRs para exportar (todos ou apenas o selecionado)
            const okrsToExport = selectedOkrId 
                ? [allOkrs.find(o => o.id === selectedOkrId)].filter(Boolean) 
                : (currentUserData.role === 'admin' ? allOkrs : allOkrs.filter(o => o.responsibleTeamId === currentUserData.teamId));
            
            if (okrsToExport.length === 0) {
                showToast('Nenhum OKR para exportar', true);
                showLoading(false);
                return;
            }
            
            // Cabeçalhos CSV
            let csvContent = "Objetivo;Equipe;Período;Progresso (%);Descrição;";
            
            // Determinar o número máximo de KRs em qualquer OKR para construir os cabeçalhos
            const maxKrs = Math.max(...okrsToExport.map(okr => (okr.keyResults || []).length));
            
            // Adicionar cabeçalhos para KRs
            for (let i = 1; i <= maxKrs; i++) {
                csvContent += `KR ${i} Título;KR ${i} Valor Inicial;KR ${i} Valor Atual;KR ${i} Meta;KR ${i} Unidade;KR ${i} Progresso (%);`;
            }
            
            // Adicionar cabeçalho para observações se necessário
            csvContent += "Observações\n";
            
            // Adicionar dados de cada OKR
            okrsToExport.forEach(okr => {
                const progress = calculateOkrProgress(okr.keyResults || []);
                const team = allTeams.find(t => t.id === okr.responsibleTeamId);
                
                // Informações básicas do OKR
                csvContent += `"${(okr.title || okr.objective).replace(/"/g, '""')}";`;
                csvContent += `"${(team?.name || 'N/A').replace(/"/g, '""')}";`;
                csvContent += `"${(okr.period || 'N/A').replace(/"/g, '""')}";`;
                csvContent += `${progress.toFixed(0)};`;
                csvContent += `"${(okr.description || '').replace(/"/g, '""')}";`;
                
                // Dados de cada KR
                const keyResults = okr.keyResults || [];
                for (let i = 0; i < maxKrs; i++) {
                    if (i < keyResults.length) {
                        const kr = keyResults[i];
                        const krProgress = calculateKrProgress(kr);
                        
                        csvContent += `"${(kr.indicator || kr.title || '').replace(/"/g, '""')}";`;
                        csvContent += `${kr.initialValue || 0};`;
                        csvContent += `${kr.currentValue || 0};`;
                        csvContent += `${kr.targetValue || 0};`;
                        csvContent += `"${(kr.unit || '').replace(/"/g, '""')}";`;
                        csvContent += `${krProgress.toFixed(0)};`;
                    } else {
                        // Preencher com células vazias se não houver KR
                        csvContent += ";;;;;;;;";
                    }
                }
                
                // Adicionar histórico de observações (última atualização)
                if (okr.history && okr.history.length > 0) {
                    const latestUpdate = [...okr.history].sort((a, b) => 
                        new Date(b.updatedAt) - new Date(a.updatedAt))[0];
                    csvContent += `"${latestUpdate.updatedBy} em ${new Date(latestUpdate.updatedAt).toLocaleDateString('pt-BR')}: ${latestUpdate.comment.replace(/"/g, '""')}"`;
                }
                
                csvContent += "\n";
            });
            
            // Criar um Blob com o conteúdo CSV e fazer download
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            
            link.setAttribute("href", url);
            link.setAttribute("download", selectedOkrId ? 'metrific-okr.csv' : 'metrific-todos-okrs.csv');
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('Planilha exportada com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            showToast('Erro ao exportar a planilha.', true);
        } finally {
            showLoading(false);
        }
    }
    
    // --- CÁLCULOS ---
    const calculateOkrProgress = (keyResults) => { 
        if (!keyResults || keyResults.length === 0) return 0;
        const totalProgress = keyResults.reduce((acc, kr) => acc + calculateKrProgress(kr), 0);
        return totalProgress / keyResults.length;
    };
    
    const calculateKrProgress = (kr) => { 
        if (!kr || kr.targetValue === kr.initialValue) return 0;
        const progress = ((kr.currentValue - kr.initialValue) / (kr.targetValue - kr.initialValue)) * 100;
        return Math.max(0, Math.min(100, progress));
    };
    
    const getKRProgressColor = (kr) => {
        const progress = calculateKrProgress(kr);
        if (progress >= 100) return 'bg-green-500';
        if (progress > 70) return 'bg-blue-500';
        return 'bg-yellow-500';
    };

    // --- MANIPULADOR DE EVENTOS GERAL ---
    document.getElementById('main-content').addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.getAttribute('data-action');
        const id = target.getAttribute('data-id');
        
        e.preventDefault();
        
        // Ações para OKRs
        if (action === 'add-okr') {
            openOkrModal();
        } else if (action === 'edit-okr') {
            e.stopPropagation(); // Prevenir a seleção do OKR ao editar
            openOkrModal(allOkrs.find(okr => okr.id === id));
        } else if (action === 'delete-okr') {
            e.stopPropagation(); // Prevenir a seleção do OKR ao deletar
            showConfirmationModal('Tem certeza que deseja excluir este OKR?', 
                async () => { await deleteItem(OKRS_COLLECTION, id, 'OKR'); });
        } else if (action === 'update-okr') {
            openUpdateOkrModal(selectedOkrId);
        } else if (action === 'select-okr') {
            selectedOkrId = selectedOkrId === id ? null : id;
            renderOkrList();
        } else if (action === 'export-pdf') {
            exportToPdf();
        } else if (action === 'export-csv') {
            exportToCsv();
        }
        
        // Ações para Setores e Equipes
        else if (action === 'add-sector') {
            handleEditSector();
        } else if (action === 'edit-sector') {
            const sector = allSectors.find(s => s.id === id);
            handleEditSector(sector);
        } else if (action === 'delete-sector') {
            handleDeleteSector(id);
        } else if (action === 'add-team') {
            handleEditTeam();
        } else if (action === 'edit-team') {
            const team = allTeams.find(t => t.id === id);
            handleEditTeam(team);
        } else if (action === 'delete-team') {
            handleDeleteTeam(id);
        }
        
        // Ações para Usuários
        else if (action === 'edit-user') {
            handleEditUser(id);
        } else if (action === 'delete-user') {
            handleDeleteUser(id);
        }
    });

    // --- MODAIS, FORMULÁRIOS E DELEÇÃO ---
    async function deleteItem(collection, id, itemName) { 
        showLoading(true);
        try {
            await db.collection(collection).doc(id).delete();
            showToast(`${itemName} excluído com sucesso!`);
            if (itemName === 'OKR' && selectedOkrId === id) {
                selectedOkrId = null;
            }
        } catch (error) {
            console.error(`Erro ao excluir ${itemName}:`, error);
            showToast(`Erro ao excluir ${itemName}.`, true);
        } finally {
            showLoading(false);
        }
    }
    
    function openOkrModal(okr = null) {
        const isEditing = !!okr;
        const modal = document.getElementById('okr-modal');
        const form = document.getElementById('okr-form');
        const modalTitle = document.getElementById('modal-title');
        
        modalTitle.textContent = isEditing ? 'Editar OKR' : 'Novo OKR';
        
        const periodOptions = ['Mensal', 'Trimestral', 'Anual'].map(
            p => `<option value="${p}" ${okr && okr.period === p ? 'selected' : ''}>${p}</option>`
        ).join('');
        
        const levelOptions = ['Empresa', 'Departamento', 'Equipe', 'Individual'].map(
            l => `<option value="${l}" ${okr && okr.level === l ? 'selected' : ''}>${l}</option>`
        ).join('');
        
        let teamSelectHtml = '';
        if (currentUserData.role === 'admin') {
            const teamOptions = allTeams.map(team => 
                `<option value="${team.id}" ${okr && okr.responsibleTeamId === team.id ? 'selected' : ''}>${team.name}</option>`
            ).join('');
            
            teamSelectHtml = `
                <div class="space-y-2">
                    <label for="okr-responsible-team" class="block text-sm font-medium text-slate-700">Equipe Responsável</label>
                    <select id="okr-responsible-team" class="w-full px-4 py-2 border border-slate-300 rounded-lg">
                        <option value="">Selecione uma equipe</option>
                        ${teamOptions}
                    </select>
                </div>
            `;
        }
        
        form.innerHTML = `
            <input type="hidden" id="okr-id" value="${okr ? okr.id : ''}">
            
            <div class="space-y-2">
                <label for="okr-title" class="block text-sm font-medium text-slate-700">Título do Objetivo</label>
                <input type="text" id="okr-title" class="w-full px-4 py-2 border border-slate-300 rounded-lg" 
                    value="${okr ? okr.title || okr.objective || '' : ''}" required>
            </div>
            
            <div class="space-y-2">
                <label for="okr-description" class="block text-sm font-medium text-slate-700">Descrição (opcional)</label>
                <textarea id="okr-description" class="w-full px-4 py-2 border border-slate-300 rounded-lg" rows="3">${okr?.description || ''}</textarea>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label for="okr-period" class="block text-sm font-medium text-slate-700">Período</label>
                    <select id="okr-period" class="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                        ${periodOptions}
                    </select>
                </div>
                
                <div class="space-y-2">
                    <label for="okr-level" class="block text-sm font-medium text-slate-700">Nível</label>
                    <select id="okr-level" class="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                        ${levelOptions}
                    </select>
                </div>
            </div>
            
            ${teamSelectHtml}
            
            <div class="space-y-2 pt-2">
                <div class="flex justify-between items-center">
                    <label class="block text-sm font-medium text-slate-700">Resultados-Chave</label>
                    <button type="button" id="add-kr-btn" class="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <i class="ph-plus-circle text-lg mr-1"></i>Adicionar KR
                    </button>
                </div>
                
                <div id="kr-container" class="space-y-4">
                    ${
                        (okr && okr.keyResults && okr.keyResults.length > 0)
                        ? okr.keyResults.map((kr, idx) => `
                            <div class="kr-input-group p-4 border border-slate-200 rounded-lg">
                                <div class="flex justify-between items-center mb-3">
                                    <h4 class="font-semibold text-slate-800">Resultado-Chave #${idx + 1}</h4>
                                    <button type="button" class="remove-kr-btn text-red-500 hover:text-red-700">
                                        <i class="ph-trash text-lg"></i>
                                    </button>
                                </div>
                                
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                                        <input type="text" class="kr-indicator w-full px-4 py-2 border border-slate-300 rounded-lg" 
                                               value="${kr.indicator || kr.title || ''}" required>
                                    </div>
                                    
                                    <div class="grid grid-cols-4 gap-3">
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Valor Inicial</label>
                                            <input type="number" step="any" class="kr-initial-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                                                   value="${kr.initialValue || 0}" required>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Valor Atual</label>
                                            <input type="number" step="any" class="kr-current-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                                                   value="${kr.currentValue || 0}" required>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Valor Alvo</label>
                                            <input type="number" step="any" class="kr-target-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                                                   value="${kr.targetValue || 0}" required>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                                            <input type="text" class="kr-unit w-full px-4 py-2 border border-slate-300 rounded-lg" 
                                                   value="${kr.unit || ''}" placeholder="Ex: %">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                        : ''
                    }
                </div>
            </div>
            
            ${isEditing ? `
                <div class="space-y-2 pt-3 border-t border-slate-200 mt-4">
                    <label for="okr-update-comment" class="block text-sm font-medium text-slate-700">Observação sobre a atualização</label>
                    <textarea id="okr-update-comment" class="w-full px-4 py-2 border border-slate-300 rounded-lg" rows="2" required></textarea>
                </div>
            ` : ''}
        `;
        
        // Se não houver KRs iniciais, adicionar um em branco
        const krContainer = form.querySelector('#kr-container');
        if (!krContainer.innerHTML.trim()) {
            addKeyResultInput(null, form);
        }
        
        // Configurar eventos para adicionar e remover KRs
        document.getElementById('add-kr-btn').addEventListener('click', () => {
            addKeyResultInput(null, form);
        });
        
        krContainer.addEventListener('click', (e) => {
            if (e.target.closest('.remove-kr-btn')) {
                const group = e.target.closest('.kr-input-group');
                if (krContainer.querySelectorAll('.kr-input-group').length > 1) {
                    group.remove();
                } else {
                    showToast('É necessário pelo menos um Resultado-Chave.', true);
                }
            }
        });
        
        modal.style.display = 'flex';
        form.onsubmit = handleOkrFormSubmit;
    }
    
    function openUpdateOkrModal(okrId) {
        const okr = allOkrs.find(o => o.id === okrId);
        if (!okr) {
            showToast('OKR não encontrado.', true);
            return;
        }
        
        const modal = document.getElementById('update-okr-modal');
        const form = document.getElementById('update-okr-form');
        const title = document.getElementById('update-modal-title');
        
        title.textContent = `Atualizar Progresso: ${okr.title || okr.objective}`;
        
        form.innerHTML = `
            <input type="hidden" id="update-okr-id" value="${okr.id}">
            
            <div class="space-y-4">
                ${(okr.keyResults || []).map((kr, idx) => `
                    <div class="bg-white border border-slate-200 rounded-lg p-4">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-medium text-slate-800">${kr.indicator || kr.title}</h4>
                            <div class="text-right">
                                <span class="text-xs text-slate-500">Meta: ${kr.targetValue} ${kr.unit || ''}</span>
                            </div>
                        </div>
                        
                        <div class="mb-2 flex items-center space-x-4">
                            <div class="text-sm text-slate-500 w-20">
                                <span>Inicial: ${kr.initialValue}</span>
                            </div>
                            <div class="flex-1">
                                <input type="range" id="kr-range-${idx}" min="${kr.initialValue}" max="${kr.targetValue}" 
                                       step="1" value="${kr.currentValue}" class="w-full">
                            </div>
                            <div class="text-lg font-mono w-24">
                                <input type="number" step="any" id="kr-current-${idx}" value="${kr.currentValue}" 
                                       class="w-full text-right px-2 py-1 border border-slate-300 rounded">
                            </div>
                            <div class="text-sm text-slate-700">
                                ${kr.unit || ''}
                            </div>
                        </div>
                        
                        <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div class="h-2 rounded-full ${getKRProgressColor(kr)}" 
                                 style="width: ${calculateKrProgress(kr)}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="space-y-2 pt-4 border-t border-slate-200 mt-4">
                <label for="update-observation" class="block text-sm font-medium text-slate-700">Observação</label>
                <textarea id="update-observation" class="w-full px-4 py-2 border border-slate-300 rounded-lg" rows="3" 
                          placeholder="Descreva o progresso ou dificuldades encontradas..." required></textarea>
            </div>
        `;
        
        // Sincronizar sliders com inputs de valor
        (okr.keyResults || []).forEach((kr, idx) => {
            const rangeInput = document.getElementById(`kr-range-${idx}`);
            const valueInput = document.getElementById(`kr-current-${idx}`);
            
            if (rangeInput && valueInput) {
                rangeInput.addEventListener('input', () => {
                    valueInput.value = rangeInput.value;
                });
                
                valueInput.addEventListener('input', () => {
                    const newValue = parseFloat(valueInput.value);
                    if (!isNaN(newValue)) {
                        if (newValue < parseFloat(rangeInput.min)) {
                            valueInput.value = rangeInput.min;
                        } else if (newValue > parseFloat(rangeInput.max)) {
                            valueInput.value = rangeInput.max;
                        }
                        rangeInput.value = valueInput.value;
                    }
                });
            }
        });
        
        modal.style.display = 'flex';
    }
    
    function addKeyResultInput(kr, form) {
        const krContainer = form.querySelector('#kr-container');
        const krCount = krContainer.querySelectorAll('.kr-input-group').length;
        
        const krGroup = document.createElement('div');
        krGroup.className = 'kr-input-group p-4 border border-slate-200 rounded-lg';
        
        krGroup.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-semibold text-slate-800">Resultado-Chave #${krCount + 1}</h4>
                <button type="button" class="remove-kr-btn text-red-500 hover:text-red-700">
                    <i class="ph-trash text-lg"></i>
                </button>
            </div>
            
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                    <input type="text" class="kr-indicator w-full px-4 py-2 border border-slate-300 rounded-lg" 
                           value="${kr?.indicator || kr?.title || ''}" required>
                </div>
                
                <div class="grid grid-cols-4 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Valor Inicial</label>
                        <input type="number" step="any" class="kr-initial-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                               value="${kr?.initialValue || 0}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Valor Atual</label>
                        <input type="number" step="any" class="kr-current-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                               value="${kr?.currentValue || 0}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Valor Alvo</label>
                        <input type="number" step="any" class="kr-target-value w-full px-4 py-2 border border-slate-300 rounded-lg" 
                               value="${kr?.targetValue || 0}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                        <input type="text" class="kr-unit w-full px-4 py-2 border border-slate-300 rounded-lg" 
                               value="${kr?.unit || ''}" placeholder="Ex: %">
                    </div>
                </div>
            </div>
        `;
        
        krContainer.appendChild(krGroup);
    }
    
    // --- FUNÇÕES DE MANIPULAÇÃO ---
    async function handleOkrFormSubmit(e) {
        e.preventDefault();
        showLoading(true);
        
        try {
            const form = document.getElementById('okr-form');
            const okrId = form.querySelector('#okr-id').value;
            const commentInput = form.querySelector('#okr-update-comment');
            
            if (okrId && !commentInput.value.trim()) {
                showToast('Por favor, adicione uma observação para a atualização.', true);
                commentInput.focus();
                return;
            }
            
            const keyResults = Array.from(form.querySelectorAll('.kr-input-group')).map(group => {
                return {
                    indicator: group.querySelector('.kr-indicator').value,
                    initialValue: parseFloat(group.querySelector('.kr-initial-value').value),
                    currentValue: parseFloat(group.querySelector('.kr-current-value').value),
                    targetValue: parseFloat(group.querySelector('.kr-target-value').value),
                    unit: group.querySelector('.kr-unit').value
                };
            });
            
            const responsibleTeamId = (currentUserData.role === 'admin' && form.querySelector('#okr-responsible-team')) 
                ? form.querySelector('#okr-responsible-team').value 
                : currentUserData.teamId;
                
            const selectedTeam = allTeams.find(t => t.id === responsibleTeamId);
            
            const okrData = {
                title: form.querySelector('#okr-title').value,
                objective: form.querySelector('#okr-title').value, // Para compatibilidade com dados existentes
                description: form.querySelector('#okr-description').value,
                period: form.querySelector('#okr-period').value,
                level: form.querySelector('#okr-level').value,
                responsibleTeamId: responsibleTeamId || null,
                responsibleSectorId: selectedTeam ? selectedTeam.sectorId : null,
                keyResults: keyResults,
                updatedAt: new Date().toISOString()
            };
            
            if (okrId) {
                const okrRef = db.collection(OKRS_COLLECTION).doc(okrId);
                const newHistoryEntry = {
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUserData.name,
                    comment: commentInput.value.trim()
                };
                
                await okrRef.update({
                    ...okrData,
                    history: firebase.firestore.FieldValue.arrayUnion(newHistoryEntry)
                });
                
                showToast('OKR atualizado com sucesso!');
            } else {
                await db.collection(OKRS_COLLECTION).add({
                    ...okrData,
                    createdAt: new Date().toISOString(),
                    history: []
                });
                
                showToast('OKR criado com sucesso!');
            }
            
            document.getElementById('okr-modal').style.display = 'none';
        } catch (error) {
            console.error("Erro ao salvar OKR:", error);
            showToast('Erro ao salvar o OKR.', true);
        } finally {
            showLoading(false);
        }
    }

    async function handleUpdateOkrFormSubmit(e) {
        e.preventDefault();
        showLoading(true);
        
        try {
            const form = document.getElementById('update-okr-form');
            const okrId = form.querySelector('#update-okr-id').value;
            const observation = form.querySelector('#update-observation').value;
            
            if (!observation.trim()) {
                showToast('A observação é obrigatória.', true);
                form.querySelector('#update-observation').focus();
                return;
            }
            
            const originalOkr = allOkrs.find(o => o.id === okrId);
            if (!originalOkr) {
                showToast('OKR não encontrado.', true);
                return;
            }
            
            const updatedKeyResults = originalOkr.keyResults.map((kr, index) => {
                const newCurrentValue = parseFloat(document.getElementById(`kr-current-${index}`).value);
                return {
                    ...kr,
                    currentValue: isNaN(newCurrentValue) ? kr.currentValue : newCurrentValue
                };
            });
            
            const newHistoryEntry = {
                updatedAt: new Date().toISOString(),
                updatedBy: currentUserData.name,
                comment: observation.trim()
            };
            
            await db.collection(OKRS_COLLECTION).doc(okrId).update({
                keyResults: updatedKeyResults,
                history: firebase.firestore.FieldValue.arrayUnion(newHistoryEntry)
            });
            
            showToast('OKR atualizado com sucesso!');
            document.getElementById('update-okr-modal').style.display = 'none';
            selectedOkrId = null;
            renderOkrList();
        } catch (error) {
            console.error("Erro ao atualizar OKR:", error);
            showToast('Erro ao atualizar o OKR.', true);
        } finally {
            showLoading(false);
        }
    }
    
    function handleEditSector(sector = null) {
        document.getElementById('generic-modal-title').textContent = sector ? 'Editar Setor' : 'Novo Setor';
        document.getElementById('generic-modal-body').innerHTML = `
            <div>
                <label for="modal-input-name" class="block text-sm font-medium text-slate-700 mb-1">Nome do Setor</label>
                <input type="text" id="modal-input-name" class="w-full px-4 py-2 border border-slate-300 rounded-lg" 
                    value="${sector ? sector.name : ''}" required>
            </div>
        `;
        
        document.getElementById('generic-modal').style.display = 'flex';
        
        document.getElementById('generic-modal-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('modal-input-name').value;
            if (!name.trim()) {
                showToast('O nome do setor é obrigatório.', true);
                return;
            }
            
            showLoading(true);
            
            try {
                if (sector) {
                    await db.collection(SECTORS_COLLECTION).doc(sector.id).update({ name });
                    showToast('Setor atualizado com sucesso!');
                } else {
                    await db.collection(SECTORS_COLLECTION).add({ name });
                    showToast('Setor criado com sucesso!');
                }
                
                document.getElementById('generic-modal').style.display = 'none';
            } catch (error) {
                console.error("Erro ao salvar setor:", error);
                showToast('Erro ao salvar o setor.', true);
            } finally {
                showLoading(false);
            }
        };
    }
    
    async function handleDeleteSector(sectorId) {
        // Verificar se existem equipes no setor
        const teamsInSector = allTeams.filter(team => team.sectorId === sectorId);
        
        if (teamsInSector.length > 0) {
            showToast('Não é possível excluir um setor que possui equipes. Remova as equipes primeiro.', true);
            return;
        }
        
        showConfirmationModal('Tem certeza que deseja excluir este setor?', async () => {
            showLoading(true);
            
            try {
                await db.collection(SECTORS_COLLECTION).doc(sectorId).delete();
                showToast('Setor excluído com sucesso!');
            } catch (error) {
                console.error("Erro ao excluir setor:", error);
                showToast('Erro ao excluir o setor.', true);
            } finally {
                showLoading(false);
            }
        });
    }
    
    function handleEditTeam(team = null) {
        if (allSectors.length === 0) {
            showToast('Você precisa criar pelo menos um setor antes de criar uma equipe.', true);
            return;
        }
        
        document.getElementById('generic-modal-title').textContent = team ? 'Editar Equipe' : 'Nova Equipe';
        
        const sectorOptions = allSectors.map(s => 
            `<option value="${s.id}" ${team && team.sectorId === s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('');
        
        document.getElementById('generic-modal-body').innerHTML = `
            <div>
                <label for="modal-input-name" class="block text-sm font-medium text-slate-700 mb-1">Nome da Equipe</label>
                <input type="text" id="modal-input-name" class="w-full px-4 py-2 border border-slate-300 rounded-lg" 
                    value="${team ? team.name : ''}" required>
            </div>
            <div class="mt-4">
                <label for="modal-select-sector" class="block text-sm font-medium text-slate-700 mb-1">Setor</label>
                <select id="modal-select-sector" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white" required>
                    ${sectorOptions}
                </select>
            </div>
        `;
        
        document.getElementById('generic-modal').style.display = 'flex';
        
        document.getElementById('generic-modal-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('modal-input-name').value;
            const sectorId = document.getElementById('modal-select-sector').value;
            
            if (!name.trim()) {
                showToast('O nome da equipe é obrigatório.', true);
                return;
            }
            
            showLoading(true);
            
            try {
                const data = { name, sectorId };
                
                if (team) {
                    await db.collection(TEAMS_COLLECTION).doc(team.id).update(data);
                    showToast('Equipe atualizada com sucesso!');
                } else {
                    await db.collection(TEAMS_COLLECTION).add(data);
                    showToast('Equipe criada com sucesso!');
                }
                
                document.getElementById('generic-modal').style.display = 'none';
            } catch (error) {
                console.error("Erro ao salvar equipe:", error);
                showToast('Erro ao salvar a equipe.', true);
            } finally {
                showLoading(false);
            }
        };
    }
    
    async function handleDeleteTeam(teamId) {
        // Verificar se existem usuários na equipe
        const usersInTeam = allUsers.filter(user => user.teamId === teamId);
        
        const warningMessage = usersInTeam.length > 0 
            ? 'Esta ação removerá a associação de todos os usuários com esta equipe. Deseja continuar?' 
            : 'Tem certeza que deseja excluir esta equipe?';
        
        showConfirmationModal(warningMessage, async () => {
            showLoading(true);
            
            try {
                const batch = db.batch();
                
                // Atualizar usuários que pertenciam à equipe
                for (const user of usersInTeam) {
                    const userRef = db.collection(USERS_COLLECTION).doc(user.id);
                    batch.update(userRef, { 
                        teamId: null,
                        sectorId: null
                    });
                }
                
                // Excluir a equipe
                batch.delete(db.collection(TEAMS_COLLECTION).doc(teamId));
                
                await batch.commit();
                showToast('Equipe excluída com sucesso!');
            } catch (error) {
                console.error("Erro ao excluir equipe:", error);
                showToast('Erro ao excluir a equipe.', true);
            } finally {
                showLoading(false);
            }
        });
    }

    // --- USUÁRIOS: EDIÇÃO E EXCLUSÃO ---
    function handleEditUser(userId) {
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            showToast('Usuário não encontrado.', true);
            return;
        }

        // Monta opções de equipe
        const teamOptions = allTeams.map(team =>
            `<option value="${team.id}" ${user.teamId === team.id ? 'selected' : ''}>${team.name}</option>`
        ).join('');
        // Monta opções de setor (apenas exibição)
        const sectorName = allSectors.find(s => s.id === user.sectorId)?.name || 'Sem setor';

        // Monta opções de papel
        const roleOptions = [
            { value: 'admin', label: 'Administrador' },
            { value: 'colaborador', label: 'Colaborador' }
        ].map(opt =>
            `<option value="${opt.value}" ${user.role === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        // Modal de edição
        document.getElementById('generic-modal-title').textContent = 'Editar Usuário';
        document.getElementById('generic-modal-body').innerHTML = `
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input type="text" id="modal-user-name" class="w-full px-4 py-2 border border-slate-300 rounded-lg" value="${user.name}" required>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100" value="${user.email}" disabled>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Equipe</label>
                <select id="modal-user-team" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="">Sem equipe</option>
                    ${teamOptions}
                </select>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Setor</label>
                <input type="text" id="modal-user-sector" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100" value="${sectorName}" disabled>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Pode editar OKRs?</label>
                <select id="modal-user-can-edit-okrs" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="true" ${user.canEditOKRs ? 'selected' : ''}>Sim</option>
                    <option value="false" ${!user.canEditOKRs ? 'selected' : ''}>Não</option>
                </select>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Papel</label>
                <select id="modal-user-role" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white">
                    ${roleOptions}
                </select>
            </div>
        `;

        document.getElementById('generic-modal').style.display = 'flex';

        document.getElementById('generic-modal-form').onsubmit = async (e) => {
            e.preventDefault();
            showLoading(true);

            try {
                const name = document.getElementById('modal-user-name').value.trim();
                const teamId = document.getElementById('modal-user-team').value || null;
                const canEditOKRs = document.getElementById('modal-user-can-edit-okrs').value === 'true';
                const role = document.getElementById('modal-user-role').value;

                // Atualiza setor conforme equipe selecionada
                let sectorId = null;
                if (teamId) {
                    const team = allTeams.find(t => t.id === teamId);
                    sectorId = team ? team.sectorId : null;
                }

                await db.collection(USERS_COLLECTION).doc(userId).update({
                    name,
                    teamId,
                    sectorId,
                    canEditOKRs,
                    role
                });

                showToast('Usuário atualizado com sucesso!');
                document.getElementById('generic-modal').style.display = 'none';
            } catch (error) {
                console.error("Erro ao editar usuário:", error);
                showToast('Erro ao editar o usuário.', true);
            } finally {
                showLoading(false);
            }
        };

        // Atualiza setor automaticamente ao trocar equipe
        document.getElementById('modal-user-team').addEventListener('change', function () {
            const teamId = this.value;
            let sectorName = 'Sem setor';
            if (teamId) {
                const team = allTeams.find(t => t.id === teamId);
                if (team) {
                    const sector = allSectors.find(s => s.id === team.sectorId);
                    if (sector) sectorName = sector.name;
                }
            }
            document.getElementById('modal-user-sector').value = sectorName;
        });
    }

    function handleDeleteUser(userId) {
        showConfirmationModal('Tem certeza que deseja excluir este usuário?', async () => {
            showLoading(true);
            try {
                await db.collection(USERS_COLLECTION).doc(userId).delete();
                showToast('Usuário excluído com sucesso!');
            } catch (error) {
                console.error("Erro ao excluir usuário:", error);
                showToast('Erro ao excluir o usuário.', true);
            } finally {
                showLoading(false);
            }
        });
    }

    // --- FUNÇÕES GLOBAIS ---
    function setupGlobalEventListeners() {
        // Login e Signup
        document.getElementById('login-form')?.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            loginUser(e.target.email.value, e.target.password.value);
        });
        
        // Adiciona o listener do formulário de cadastro
        document.getElementById('signup-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = e.target.querySelector('#signup-name').value;
            const email = e.target.querySelector('#signup-email').value;
            const password = e.target.querySelector('#signup-password').value;
            const invite = e.target.querySelector('#signup-invite').value;
            if (invite !== 'EJECTMETRIFIC') {
                showToast('Código de convite inválido.', true);
                e.target.querySelector('#signup-invite').focus();
                return;
            }
            registerUser(name, email, password);
        });

        // Adiciona o listener do botão de logout
        document.getElementById('logout-button')?.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            signupView.style.display = 'none';
            loginView.style.display = 'flex';
        });
        
        // Adiciona o listener do botão de cadastro na tela de login
        document.getElementById('show-signup')?.addEventListener('click', (e) => {
            e.preventDefault();
            loginView.style.display = 'none';
            signupView.style.display = 'flex';
        });

        // Modal de versão
        const versionButton = document.getElementById('version-button');
        const versionModal = document.getElementById('version-modal');
        const closeVersionButton = document.getElementById('close-version-modal');
        
        if (versionButton && versionModal) {
            versionButton.addEventListener('click', () => {
                console.log('Abrindo modal de versão');
                versionModal.style.display = 'flex';
            });
        }
        
        if (closeVersionButton && versionModal) {
            closeVersionButton.addEventListener('click', () => {
                console.log('Fechando modal de versão');
                versionModal.style.display = 'none';
            });
        }
        
        // Melhorar a funcionalidade dos botões de cancelar modal
        setupModalControls();
    }
    
    // --- CONTROLE DE MODAIS ---
    function setupModalControls() {
        // Identificar todos os modais da aplicação
        const allModals = [
            'okr-modal',
            'update-okr-modal',
            'generic-modal',
            'confirmation-modal',
            'version-modal'
        ];
        
        // Função para fechar qualquer modal
        function closeAllModals() {
            allModals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal) modal.style.display = 'none';
            });
        }
        
        // Adicionar evento aos botões de cancelar
        document.querySelectorAll('.cancel-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeAllModals();
            });
        });
        
        // Adicionar evento global para detectar tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });
        
        // Também fazer com que cliques fora do conteúdo do modal fechem o modal
        allModals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', function(e) {
                    // Se o clique foi diretamente no fundo do modal (não em seu conteúdo)
                    if (e.target === modal) {
                        closeAllModals();
                    }
                });
            }
        });
    }
    
    // Inicializar listeners quando o DOM estiver pronto
    setupGlobalEventListeners();
});

// REMOVER TODO O CÓDIGO QUE ESTAVA AQUI FORA DO DOMCONTENTLOADED