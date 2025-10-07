document.addEventListener('DOMContentLoaded', () => {
            // Verificar se o Firebase está disponível e configurado
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase não está disponível para salvamento na nuvem');
                return;
            }
            
            // Verificar se o database está disponível
            if (typeof firebase.database !== 'function') {
                console.warn('⚠️ Firebase Realtime Database não está disponível');
                return;
            }
            
            try {
                const db = firebase.database();
                const auth = firebase.auth();

                const trilhaId = document.getElementById('trilha-id').value;
                const checkboxes = document.querySelectorAll('.topic-checkbox');
                const totalTopics = checkboxes.length;

                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                const progressStatus = document.getElementById('progress-status');

                let currentUser = null;
                let localProgress = {};

                function updateProgressBar() {
                    const completedCount = Object.values(localProgress).filter(Boolean).length;
                    const percentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

                    progressBar.style.width = `${percentage}%`;
                    progressBar.classList.toggle('bg-green-600', percentage === 100);
                    progressBar.classList.toggle('bg-sky-600', percentage < 100);
                    progressText.textContent = `${completedCount} de ${totalTopics} tópicos concluídos (${percentage}%)`;
                }

                function applyProgressToUI() {
                    checkboxes.forEach(checkbox => {
                        const key = checkbox.dataset.key;
                        checkbox.checked = !!localProgress[key];
                    });
                    updateProgressBar();
                }

                async function saveProgressToDatabase() {
                    if (!currentUser) return;
                    progressStatus.textContent = 'Salvando...';
                    progressStatus.className = 'text-sm font-medium text-yellow-600';

                    const progressRef = db.ref(`users/${currentUser.uid}/progress/${trilhaId}`);
                    try {
                        await progressRef.set(localProgress);
                        progressStatus.textContent = 'Progresso salvo na nuvem';
                        progressStatus.className = 'text-sm font-medium text-green-600';
                    } catch (error) {
                        console.error("Erro ao salvar no Realtime Database: ", error);
                        progressStatus.textContent = 'Erro ao salvar';
                        progressStatus.className = 'text-sm font-medium text-red-600';
                    }
                }

                const debouncedSave = (() => {
                    let timeout;
                    return () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(saveProgressToDatabase, 1500);
                    };
                })();

                async function loadProgressFromDatabase() {
                    if (!currentUser) return;
                    progressStatus.textContent = 'Carregando...';
                    progressStatus.className = 'text-sm font-medium text-gray-500';

                    const progressRef = db.ref(`users/${currentUser.uid}/progress/${trilhaId}`);
                    try {
                        const snapshot = await progressRef.once('value');
                        if (snapshot.exists()) {
                            localProgress = snapshot.val();
                            applyProgressToUI();
                            progressStatus.textContent = 'Progresso carregado da nuvem';
                            progressStatus.className = 'text-sm font-medium text-green-600';
                        } else {
                            progressStatus.textContent = 'Nenhum progresso salvo na nuvem ainda';
                            progressStatus.className = 'text-sm font-medium text-gray-500';
                        }
                    } catch (error) {
                        console.error("Erro ao carregar do Realtime Database: ", error);
                        progressStatus.textContent = 'Erro ao carregar progresso';
                        progressStatus.className = 'text-sm font-medium text-red-600';
                    }
                }

                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        const key = checkbox.dataset.key;
                        localProgress[key] = checkbox.checked;
                        updateProgressBar();
                        debouncedSave();
                    });
                });

                auth.onAuthStateChanged(user => {
                    if (user) {
                        currentUser = user;
                        loadProgressFromDatabase();
                    } else {
                        currentUser = null;
                        // Se não houver usuário, redireciona para a página de login para evitar inconsistências.
                        console.log('Usuário não autenticado. Redirecionando para login...');
                        window.location.href = './login.html';
                    }
                });
            } catch (error) {
                console.error('❌ Erro ao inicializar Firebase Database:', error);
            }
        });
