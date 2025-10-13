/**
 * Script de Verificação de Compatibilidade
 * 
 * Este script analisa os dados existentes e fornece um relatório
 * detalhado sobre o que será modificado durante a migração.
 */

// Função para analisar a estrutura atual dos usuários
async function analisarEstruturaAtual() {
    console.log('🔍 Analisando estrutura atual dos usuários...\n');
    
    try {
        const snapshot = await db.ref('users').once('value');
        
        if (!snapshot.exists()) {
            console.log('📝 Nenhum usuário encontrado no banco de dados.');
            return;
        }

        const usuarios = snapshot.val();
        const totalUsuarios = Object.keys(usuarios).length;
        
        // Contadores para análise
        let semUID = 0;
        let semEmail = 0;
        let semNome = 0;
        let semCreatedAt = 0;
        let semLastLogin = 0;
        let comCamposExtra = 0;
        let estruturaCompleta = 0;
        
        const usuariosProblematicos = [];
        const camposExtrasEncontrados = new Set();
        
        // Analisa cada usuário
        for (const [uid, dados] of Object.entries(usuarios)) {
            const problemas = [];
            
            // Verifica campos obrigatórios
            if (!dados.uid) {
                semUID++;
                problemas.push('Sem UID');
            }
            if (!dados.email) {
                semEmail++;
                problemas.push('Sem email');
            }
            if (!dados.name) {
                semNome++;
                problemas.push('Sem nome');
            }
            if (!dados.createdAt) {
                semCreatedAt++;
                problemas.push('Sem createdAt');
            }
            if (!dados.lastLogin) {
                semLastLogin++;
                problemas.push('Sem lastLogin');
            }
            
            // Verifica campos extras
            const camposEsperados = ['uid', 'email', 'name', 'createdAt', 'lastLogin'];
            const camposExtras = Object.keys(dados).filter(campo => !camposEsperados.includes(campo));
            
            if (camposExtras.length > 0) {
                comCamposExtra++;
                camposExtras.forEach(campo => camposExtrasEncontrados.add(campo));
                problemas.push(`Campos extras: ${camposExtras.join(', ')}`);
            }
            
            // Usuário com estrutura completa
            if (problemas.length === 0) {
                estruturaCompleta++;
            } else {
                usuariosProblematicos.push({
                    uid: uid,
                    email: dados.email || 'N/A',
                    nome: dados.name || dados.email?.split('@')[0] || 'N/A',
                    problemas: problemas
                });
            }
        }
        
        // Relatório da análise
        console.log('📊 RELATÓRIO DE ANÁLISE DA ESTRUTURA:');
        console.log('=====================================');
        console.log(`📈 Total de usuários: ${totalUsuarios}`);
        console.log(`✅ Com estrutura completa: ${estruturaCompleta} (${((estruturaCompleta/totalUsuarios)*100).toFixed(1)}%)`);
        console.log(`⚠️ Precisam de atualização: ${totalUsuarios - estruturaCompleta} (${(((totalUsuarios - estruturaCompleta)/totalUsuarios)*100).toFixed(1)}%)`);
        
        console.log('\n🔍 DETALHAMENTO DOS PROBLEMAS:');
        console.log(`├── Sem UID: ${semUID}`);
        console.log(`├── Sem email: ${semEmail}`);
        console.log(`├── Sem nome: ${semNome}`);
        console.log(`├── Sem createdAt: ${semCreatedAt}`);
        console.log(`├── Sem lastLogin: ${semLastLogin}`);
        console.log(`└── Com campos extras: ${comCamposExtra}`);
        
        if (camposExtrasEncontrados.size > 0) {
            console.log(`\n🗑️ Campos extras que serão removidos:`);
            Array.from(camposExtrasEncontrados).forEach(campo => {
                console.log(`   • ${campo}`);
            });
        }
        
        // Mostra alguns exemplos de usuários problemáticos
        if (usuariosProblematicos.length > 0) {
            console.log('\n👤 EXEMPLOS DE USUÁRIOS QUE SERÃO ATUALIZADOS:');
            usuariosProblematicos.slice(0, 5).forEach((usuario, index) => {
                console.log(`${index + 1}. ${usuario.nome} (${usuario.email})`);
                console.log(`   Problemas: ${usuario.problemas.join(', ')}`);
            });
            
            if (usuariosProblematicos.length > 5) {
                console.log(`   ... e mais ${usuariosProblematicos.length - 5} usuários`);
            }
        }
        
        // Estimativa de tempo
        const tempoEstimado = Math.ceil(totalUsuarios / 10); // ~10 usuários por segundo
        console.log(`\n⏱️ Tempo estimado da migração: ~${tempoEstimado} segundos`);
        
        // Recomendações
        console.log('\n💡 RECOMENDAÇÕES:');
        if (semEmail > 0) {
            console.log(`⚠️ ${semEmail} usuários sem email precisarão de atenção manual`);
        }
        if (estruturaCompleta === totalUsuarios) {
            console.log('✅ Todos os usuários já possuem a estrutura correta!');
        } else {
            console.log('📋 Execute um backup antes de prosseguir com a migração');
            console.log('🔄 A migração pode ser executada com segurança');
        }
        
        return {
            total: totalUsuarios,
            completos: estruturaCompleta,
            problematicos: usuariosProblematicos.length,
            semEmail: semEmail,
            tempoEstimado: tempoEstimado
        };
        
    } catch (error) {
        console.error('❌ Erro durante a análise:', error);
        throw error;
    }
}

// Função para simular a migração (dry run)
async function simularMigracao() {
    console.log('🎭 Simulando migração (modo dry-run)...\n');
    
    try {
        const snapshot = await db.ref('users').once('value');
        
        if (!snapshot.exists()) {
            console.log('📝 Nenhum usuário encontrado.');
            return;
        }

        const usuarios = snapshot.val();
        let usuariosQueSeraoAtualizados = 0;
        const exemplosAtualizacao = [];
        
        for (const [uid, dadosExistentes] of Object.entries(usuarios)) {
            const agora = Date.now();
            const dadosParaAtualizar = {};
            let precisaAtualizar = false;

            // Simula a mesma lógica do script de migração
            if (!dadosExistentes.uid) {
                dadosParaAtualizar.uid = uid;
                precisaAtualizar = true;
            }

            if (!dadosExistentes.name) {
                if (dadosExistentes.email) {
                    dadosParaAtualizar.name = dadosExistentes.email.split('@')[0];
                    precisaAtualizar = true;
                }
            }

            if (!dadosExistentes.createdAt) {
                dadosParaAtualizar.createdAt = agora;
                precisaAtualizar = true;
            }

            if (!dadosExistentes.lastLogin) {
                dadosParaAtualizar.lastLogin = agora;
                precisaAtualizar = true;
            }

            // Campos para remover
            const camposParaRemover = ['displayName', 'photoURL', 'phoneNumber'];
            camposParaRemover.forEach(campo => {
                if (dadosExistentes[campo] !== undefined) {
                    dadosParaAtualizar[campo] = null;
                    precisaAtualizar = true;
                }
            });

            if (precisaAtualizar) {
                usuariosQueSeraoAtualizados++;
                
                // Guarda alguns exemplos
                if (exemplosAtualizacao.length < 3) {
                    exemplosAtualizacao.push({
                        email: dadosExistentes.email || 'N/A',
                        antes: dadosExistentes,
                        atualizacoes: dadosParaAtualizar
                    });
                }
            }
        }
        
        console.log('📋 RESULTADO DA SIMULAÇÃO:');
        console.log(`📊 Usuários que serão atualizados: ${usuariosQueSeraoAtualizados}`);
        console.log(`📊 Usuários que não precisam de atualização: ${Object.keys(usuarios).length - usuariosQueSeraoAtualizados}`);
        
        if (exemplosAtualizacao.length > 0) {
            console.log('\n📝 EXEMPLOS DE ATUALIZAÇÕES:');
            exemplosAtualizacao.forEach((exemplo, index) => {
                console.log(`\n${index + 1}. Usuário: ${exemplo.email}`);
                console.log(`   Campos que serão adicionados/atualizados:`);
                Object.entries(exemplo.atualizacoes).forEach(([campo, valor]) => {
                    if (valor === null) {
                        console.log(`   • ${campo}: será removido`);
                    } else {
                        console.log(`   • ${campo}: ${valor}`);
                    }
                });
            });
        }
        
        console.log('\n✅ Simulação concluída. Nenhum dado foi modificado.');
        
    } catch (error) {
        console.error('❌ Erro na simulação:', error);
        throw error;
    }
}

// Função para verificar backups existentes
async function verificarBackups() {
    console.log('💾 Verificando backups existentes...\n');
    
    try {
        const snapshot = await db.ref('backups').once('value');
        
        if (!snapshot.exists()) {
            console.log('📁 Nenhum backup encontrado.');
            console.log('⚠️ Recomenda-se criar um backup antes da migração.');
            return;
        }
        
        const backups = snapshot.val();
        const listaBackups = Object.keys(backups);
        
        console.log(`📊 Total de backups encontrados: ${listaBackups.length}`);
        console.log('\n📋 Lista de backups:');
        
        listaBackups.forEach((backupKey, index) => {
            const backup = backups[backupKey];
            const timestamp = new Date(backup.timestamp);
            const totalUsuarios = backup.data ? Object.keys(backup.data).length : 0;
            
            console.log(`${index + 1}. ${backupKey}`);
            console.log(`   Data: ${timestamp.toLocaleString()}`);
            console.log(`   Usuários: ${totalUsuarios}`);
        });
        
        // Backup mais recente
        const backupMaisRecente = listaBackups
            .map(key => ({ key, data: new Date(backups[key].timestamp) }))
            .sort((a, b) => b.data - a.data)[0];
            
        if (backupMaisRecente) {
            const idade = Date.now() - backupMaisRecente.data.getTime();
            const idadeHoras = Math.floor(idade / (1000 * 60 * 60));
            
            console.log(`\n🕒 Backup mais recente: ${backupMaisRecente.data.toLocaleString()}`);
            console.log(`   Idade: ${idadeHoras} horas`);
            
            if (idadeHoras > 24) {
                console.log('⚠️ Backup mais recente tem mais de 24 horas. Considere criar um novo.');
            } else {
                console.log('✅ Backup recente disponível.');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar backups:', error);
        throw error;
    }
}

// Exporta as funções
window.verificacaoCompatibilidade = {
    analisar: analisarEstruturaAtual,
    simular: simularMigracao,
    verificarBackups: verificarBackups,
    
    // Função completa que executa todas as verificações
    completa: async function() {
        console.log('🔍 VERIFICAÇÃO COMPLETA DE COMPATIBILIDADE');
        console.log('==========================================\n');
        
        try {
            const analise = await analisarEstruturaAtual();
            console.log('\n' + '='.repeat(50) + '\n');
            
            await simularMigracao();
            console.log('\n' + '='.repeat(50) + '\n');
            
            await verificarBackups();
            console.log('\n' + '='.repeat(50) + '\n');
            
            console.log('✅ Verificação completa concluída!');
            
            // Recomendação final
            if (analise && analise.problematicos > 0) {
                console.log('\n🎯 PRÓXIMOS PASSOS RECOMENDADOS:');
                console.log('1. Criar um backup dos dados atuais');
                console.log('2. Executar a migração em horário de baixo tráfego');
                console.log('3. Validar os dados após a migração');
                console.log('4. Testar login com alguns usuários migrados');
            }
            
        } catch (error) {
            console.error('💥 Erro durante a verificação:', error);
        }
    }
};

console.log('✅ Script de verificação carregado. Use verificacaoCompatibilidade.completa() para iniciar.');

// Exporta para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analisarEstruturaAtual,
        simularMigracao,
        verificarBackups
    };
}