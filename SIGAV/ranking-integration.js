/**
 * Sistema de Integração Automática do Ranking Público
 * 
 * Este arquivo deve ser incluído nas páginas de trilhas para atualizar
 * automaticamente o ranking público quando o usuário completa tópicos.
 * 
 * COMO USAR:
 * 1. Inclua este arquivo após firebase-config.js
 * 2. Chame updateUserRanking() após salvar progresso do usuário
 */

// Aguarda que o Firebase esteja disponível
document.addEventListener('DOMContentLoaded', () => {
    // Aguarda um pouco para garantir que Firebase foi inicializado
    setTimeout(setupRankingIntegration, 1000);
});

/**
 * Configura a integração automática do ranking
 */
function setupRankingIntegration() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn('⚠️ Firebase não disponível para integração do ranking');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.database();

    // Sistema de pontuação (deve ser igual ao do ranking.html)
    const POINTS_CONFIG = {
        POINTS_PER_TOPIC: 10,
        TRACKS: {
            'html_e_css': { name: 'HTML & CSS', multiplier: 1.0, topics: 15 },
            'javascript': { name: 'JavaScript', multiplier: 1.2, topics: 20 },
            'python_basico': { name: 'Python Básico', multiplier: 1.1, topics: 18 },
            'git_e_github': { name: 'Git & GitHub', multiplier: 1.0, topics: 12 },
            'vue': { name: 'Vue.js', multiplier: 1.3, topics: 16 },
            'typescript': { name: 'TypeScript', multiplier: 1.4, topics: 14 },
            'django': { name: 'Django', multiplier: 1.5, topics: 22 },
            'ux_ui': { name: 'UX/UI Design', multiplier: 1.1, topics: 16 },
            'wordpress': { name: 'WordPress', multiplier: 1.0, topics: 12 },
            'marketing_comercial': { name: 'Marketing Comercial', multiplier: 1.0, topics: 14 },
            'gestao_de_tempo': { name: 'Gestão de Tempo', multiplier: 0.8, topics: 10 },
            'desenvolvimento_humano': { name: 'Desenvolvimento Humano', multiplier: 0.8, topics: 12 },
            'scrum': { name: 'Scrum', multiplier: 1.0, topics: 8 },
            'metodologia_5s': { name: 'Metodologia 5S', multiplier: 0.8, topics: 6 },
            'okrs_kpis_e_bpmn': { name: 'OKRs, KPIs e BPMN', multiplier: 1.2, topics: 15 },
            'financeiro': { name: 'Financeiro', multiplier: 1.0, topics: 10 },
            'historia_eject': { name: 'História da EJECT', multiplier: 0.5, topics: 5 }
        }
    };

    /**
     * Calcula a pontuação total de um usuário
     */
    function calculateUserScore(userProgress) {
        let totalScore = 0;
        
        if (!userProgress || typeof userProgress !== 'object') {
            return 0;
        }

        Object.keys(userProgress).forEach(trackId => {
            const trackProgress = userProgress[trackId];
            const trackConfig = POINTS_CONFIG.TRACKS[trackId];
            
            if (!trackConfig || !trackProgress || typeof trackProgress !== 'object') {
                return;
            }

            let completedTopics = 0;
            Object.values(trackProgress).forEach(topicCompleted => {
                if (topicCompleted === true) {
                    completedTopics++;
                }
            });

            const basePoints = completedTopics * POINTS_CONFIG.POINTS_PER_TOPIC;
            const trackScore = Math.round(basePoints * trackConfig.multiplier);
            totalScore += trackScore;
        });

        return totalScore;
    }

    /**
     * Atualiza o ranking público com os dados do usuário atual
     */
    async function updateUserRanking(userId = null, userData = null) {
        const user = auth.currentUser;
        if (!user) {
            console.log('👤 Usuário não logado - ranking não atualizado');
            return;
        }

        try {
            // Se não foram fornecidos dados, busca do Firebase
            if (!userId || !userData) {
                userId = user.uid;
                const userRef = db.ref(`users/${userId}`);
                const snapshot = await userRef.once('value');
                
                if (!snapshot.exists()) {
                    console.log('⚠️ Dados do usuário não encontrados');
                    return;
                }
                
                userData = snapshot.val();
            }

            const score = calculateUserScore(userData.progress);
            
            if (score > 0) {
                // Determina nome para exibição
                let displayName = 'Usuário Anônimo';
                if (userData.profile && userData.profile.displayName) {
                    displayName = userData.profile.displayName;
                } else if (userData.name) {
                    displayName = userData.name;
                } else if (user.displayName) {
                    displayName = user.displayName;
                } else if (user.email) {
                    displayName = user.email.split('@')[0];
                }

                // Atualiza ranking público
                const publicUserData = {
                    name: displayName,
                    score: score,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                };

                await db.ref(`public/ranking/${userId}`).set(publicUserData);
                console.log(`✅ Ranking público atualizado: ${displayName} - ${score} pontos`);
                
            } else {
                // Remove do ranking se não tem pontos
                await db.ref(`public/ranking/${userId}`).remove();
                console.log('🗑️ Usuário removido do ranking público (sem pontos)');
            }

        } catch (error) {
            console.warn('⚠️ Erro ao atualizar ranking público:', error);
        }
    }

    /**
     * Monitora mudanças no progresso do usuário e atualiza ranking automaticamente
     */
    function setupAutoRankingUpdate() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('🔗 Configurando atualização automática do ranking para:', user.email);
                
                // Monitora mudanças no progresso do usuário
                const progressRef = db.ref(`users/${user.uid}/progress`);
                progressRef.on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        console.log('📊 Progresso alterado, atualizando ranking...');
                        
                        // Pequeno delay para garantir que todos os dados foram salvos
                        setTimeout(() => {
                            updateUserRanking();
                        }, 2000);
                    }
                });
            }
        });
    }

    // Torna função disponível globalmente
    window.updateUserRanking = updateUserRanking;
    
    // Inicia monitoramento automático
    setupAutoRankingUpdate();
    
    console.log('✅ Sistema de integração do ranking público ativado');
}

// Função de conveniência para chamar manualmente após salvar progresso
window.syncUserWithRanking = function() {
    if (window.updateUserRanking) {
        window.updateUserRanking();
    } else {
        console.warn('⚠️ Sistema de ranking ainda não está disponível');
    }
};