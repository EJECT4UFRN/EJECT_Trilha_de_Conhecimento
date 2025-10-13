/**
 * Script de Migração de Usuários - Firebase Realtime Database
 * 
 * Este script atualiza a estrutura dos dados dos usuários existentes
 * para garantir compatibilidade com o novo formato sem causar conflitos.
 * 
 * EXECUTAR APENAS UMA VEZ!
 */

// Função para testar conexão com Realtime Database
async function testarConexaoRealtimeDatabase() {
    console.log('🔍 Testando conexão com Firebase Realtime Database...');
    
    try {
        // Tenta fazer uma leitura simples
        const testSnapshot = await db.ref('.info/connected').once('value');
        const conectado = testSnapshot.val();
        
        if (conectado) {
            console.log('✅ Conexão com Realtime Database estabelecida');
            
            // Testa leitura dos usuários
            const usersSnapshot = await db.ref('users').limitToFirst(1).once('value');
            console.log('✅ Acesso à coleção "users" confirmado');
            
            return true;
        } else {
            console.error('❌ Não conectado ao Realtime Database');
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao testar conexão com Realtime Database:', error);
        return false;
    }
}

// Verifica se o Firebase foi configurado corretamente (firebase-config.js deve ser carregado antes)
function verificarConfiguracao() {
    const problemas = [];
    
    if (typeof firebase === 'undefined') {
        problemas.push('Firebase não está disponível');
    }
    
    if (typeof db === 'undefined') {
        problemas.push('Variável "db" (Realtime Database) não está disponível');
    }
    
    if (typeof auth === 'undefined') {
        problemas.push('Variável "auth" não está disponível');
    }
    
    if (problemas.length > 0) {
        console.error('❌ Problemas de configuração encontrados:');
        problemas.forEach(problema => console.error(`   • ${problema}`));
        console.error('📋 Solução: Certifique-se de carregar firebase-config.js antes deste script');
        return false;
    }
    
    console.log('✅ Configuração do Firebase verificada com sucesso');
    return true;
}

// Executa verificação imediatamente
if (!verificarConfiguracao()) {
    console.error('❌ Script de migração não pode ser inicializado devido a problemas de configuração');
}

/**
 * Função principal de migração
 */
async function executarMigracaoUsuarios() {
    console.log('🚀 Iniciando migração de usuários...');
    
    try {
        const snapshot = await db.ref('users').once('value');
        
        if (!snapshot.exists()) {
            console.log('📝 Nenhum usuário encontrado para migração.');
            return;
        }

        const usuarios = snapshot.val();
        const totalUsuarios = Object.keys(usuarios).length;
        let usuariosAtualizados = 0;
        let usuariosJaAtualizados = 0;
        let erros = 0;

        console.log(`📊 Total de usuários encontrados: ${totalUsuarios}`);
        console.log('⏳ Processando migração...\n');

        // Processa cada usuário
        for (const [uid, dadosUsuario] of Object.entries(usuarios)) {
            try {
                const dadosAtualizados = await processarUsuario(uid, dadosUsuario);
                
                if (dadosAtualizados) {
                    await db.ref(`users/${uid}`).update(dadosAtualizados);
                    usuariosAtualizados++;
                    console.log(`✅ Usuário ${dadosUsuario.email || dadosUsuario.name || uid} atualizado`);
                } else {
                    usuariosJaAtualizados++;
                    console.log(`ℹ️ Usuário ${dadosUsuario.email || dadosUsuario.name || uid} já estava atualizado`);
                }
            } catch (error) {
                erros++;
                console.error(`❌ Erro ao processar usuário ${uid}:`, error);
            }
        }

        // Relatório final
        console.log('\n📋 RELATÓRIO DE MIGRAÇÃO:');
        console.log(`├── Total de usuários: ${totalUsuarios}`);
        console.log(`├── Usuários atualizados: ${usuariosAtualizados}`);
        console.log(`├── Usuários já atualizados: ${usuariosJaAtualizados}`);
        console.log(`└── Erros encontrados: ${erros}`);
        
        if (erros === 0) {
            console.log('🎉 Migração concluída com sucesso!');
        } else {
            console.log('⚠️ Migração concluída com alguns erros. Verifique os logs acima.');
        }

    } catch (error) {
        console.error('💥 Erro crítico durante a migração:', error);
    }
}

/**
 * Processa um usuário individual e determina quais dados precisam ser atualizados
 */
async function processarUsuario(uid, dadosExistentes) {
    const agora = Date.now();
    const dadosParaAtualizar = {};
    let precisaAtualizar = false;

    // 1. Garante que o UID está presente
    if (!dadosExistentes.uid) {
        dadosParaAtualizar.uid = uid;
        precisaAtualizar = true;
    }

    // 2. Garante que o email está presente 
    // Nota: No client-side não podemos acessar Firebase Admin SDK
    // O email deve ser preservado dos dados existentes ou solicitado manualmente
    if (!dadosExistentes.email) {
        console.warn(`⚠️ Usuário ${uid} não possui email nos dados. Isso precisará ser corrigido manualmente.`);
        // Poderíamos marcar este usuário para revisão manual
        dadosParaAtualizar._needsEmailUpdate = true;
        precisaAtualizar = true;
    }

    // 3. Garante que o name está presente (usa email como fallback se necessário)
    if (!dadosExistentes.name) {
        if (dadosExistentes.email) {
            // Usa a parte antes do @ como nome temporário
            dadosParaAtualizar.name = dadosExistentes.email.split('@')[0];
            precisaAtualizar = true;
        } else if (dadosParaAtualizar.email) {
            dadosParaAtualizar.name = dadosParaAtualizar.email.split('@')[0];
        }
    }

    // 4. Adiciona timestamp de criação se não existir
    if (!dadosExistentes.createdAt) {
        dadosParaAtualizar.createdAt = agora;
        precisaAtualizar = true;
    }

    // 5. Adiciona timestamp de último login se não existir
    if (!dadosExistentes.lastLogin) {
        dadosParaAtualizar.lastLogin = agora;
        precisaAtualizar = true;
    }

    // 6. Remove campos desnecessários ou inválidos (se existirem)
    const camposParaRemover = ['displayName', 'photoURL', 'phoneNumber'];
    camposParaRemover.forEach(campo => {
        if (dadosExistentes[campo] !== undefined) {
            dadosParaAtualizar[campo] = null; // Remove o campo
            precisaAtualizar = true;
        }
    });

    return precisaAtualizar ? dadosParaAtualizar : null;
}

/**
 * Função para fazer backup dos dados antes da migração
 */
async function fazerBackupUsuarios() {
    console.log('💾 Criando backup dos usuários...');
    
    try {
        const snapshot = await db.ref('users').once('value');
        const backup = {
            timestamp: new Date().toISOString(),
            data: snapshot.val()
        };

        // Salva o backup
        await db.ref('backups/usuarios_' + Date.now()).set(backup);
        console.log('✅ Backup criado com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar backup:', error);
        return false;
    }
}

/**
 * Função para validar a integridade dos dados após migração
 */
async function validarIntegridadeDados() {
    console.log('🔍 Validando integridade dos dados...');
    
    try {
        const snapshot = await db.ref('users').once('value');
        const usuarios = snapshot.val();
        
        if (!usuarios) {
            console.log('ℹ️ Nenhum usuário encontrado.');
            return;
        }

        let usuariosValidos = 0;
        let usuariosComProblemas = 0;

        for (const [uid, dados] of Object.entries(usuarios)) {
            const camposObrigatorios = ['email', 'name', 'uid', 'createdAt', 'lastLogin'];
            const camposFaltando = camposObrigatorios.filter(campo => !dados[campo]);

            if (camposFaltando.length === 0) {
                usuariosValidos++;
            } else {
                usuariosComProblemas++;
                console.warn(`⚠️ Usuário ${uid} possui campos faltando:`, camposFaltando);
            }
        }

        console.log(`✅ Usuários válidos: ${usuariosValidos}`);
        console.log(`⚠️ Usuários com problemas: ${usuariosComProblemas}`);
        
        return usuariosComProblemas === 0;
    } catch (error) {
        console.error('❌ Erro na validação:', error);
        return false;
    }
}

/**
 * Função principal que executa todo o processo de migração
 */
async function iniciarMigracao() {
    console.log('🔧 SISTEMA DE MIGRAÇÃO DE USUÁRIOS');
    console.log('===================================\n');

    // Confirmação antes de executar
    const confirmacao = confirm(
        'Esta operação irá atualizar todos os usuários existentes no banco de dados.\n\n' +
        'IMPORTANTE:\n' +
        '- Um backup será criado automaticamente\n' +
        '- A operação é irreversível\n' +
        '- Certifique-se de ter permissões de administrador\n\n' +
        'Deseja continuar?'
    );

    if (!confirmacao) {
        console.log('❌ Migração cancelada pelo usuário.');
        return;
    }

    // Etapa 1: Fazer backup
    const backupSucesso = await fazerBackupUsuarios();
    if (!backupSucesso) {
        console.log('❌ Migração abortada devido a falha no backup.');
        return;
    }

    // Etapa 2: Executar migração
    await executarMigracaoUsuarios();

    // Etapa 3: Validar integridade
    const integridadeOk = await validarIntegridadeDados();
    
    if (integridadeOk) {
        console.log('🎉 Migração concluída com sucesso! Todos os dados estão íntegros.');
    } else {
        console.log('⚠️ Migração concluída, mas foram encontrados alguns problemas. Verifique os logs.');
    }
}

// Função para verificar dependências do Realtime Database
function verificarDependencias() {
    try {
        const dependencias = [
            { nome: 'firebase', objeto: typeof firebase !== 'undefined' },
            { nome: 'firebase.database', objeto: typeof firebase !== 'undefined' && typeof firebase.database === 'function' },
            { nome: 'firebase.auth', objeto: typeof firebase !== 'undefined' && typeof firebase.auth === 'function' },
            { nome: 'db (Realtime Database)', objeto: typeof db !== 'undefined' && db && typeof db.ref === 'function' },
            { nome: 'auth', objeto: typeof auth !== 'undefined' && auth }
        ];
        
        const faltando = dependencias.filter(dep => !dep.objeto);
        
        if (faltando.length > 0) {
            console.error('❌ Dependências faltando para Realtime Database:', faltando.map(d => d.nome));
            
            // Diagnostico adicional
            console.log('🔍 Diagnóstico:');
            console.log('- firebase disponível:', typeof firebase !== 'undefined');
            console.log('- firebase.database disponível:', typeof firebase !== 'undefined' && typeof firebase.database);
            console.log('- db definido:', typeof db);
            console.log('- db.ref disponível:', typeof db !== 'undefined' && typeof db.ref);
            
            return false;
        }
        
        console.log('✅ Todas as dependências do Realtime Database estão disponíveis');
        return true;
    } catch (error) {
        console.error('❌ Erro ao verificar dependências:', error);
        return false;
    }
}

// Aguarda as dependências estarem disponíveis
function aguardarDependencias() {
    return new Promise((resolve) => {
        const intervalo = setInterval(() => {
            if (verificarDependencias()) {
                clearInterval(intervalo);
                resolve();
            }
        }, 100);
        
        // Timeout após 10 segundos
        setTimeout(() => {
            clearInterval(intervalo);
            console.error('❌ Timeout aguardando dependências');
            resolve();
        }, 10000);
    });
}

// Inicializa o sistema de migração
async function inicializarSistemaMigracao() {
    console.log('🔄 Aguardando dependências do Firebase Realtime Database...');
    
    await aguardarDependencias();
    
    if (!verificarDependencias()) {
        console.error('❌ Não foi possível carregar todas as dependências necessárias para o Realtime Database');
        return;
    }
    
    console.log('✅ Dependências do Realtime Database carregadas com sucesso');
    
    // Testa a conexão com o Realtime Database
    const conexaoOk = await testarConexaoRealtimeDatabase();
    if (!conexaoOk) {
        console.error('❌ Falha na conexão com o Realtime Database');
        return;
    }
    
    // Funções utilitárias para uso manual
    window.migracaoUtils = {
        executar: iniciarMigracao,
        validar: validarIntegridadeDados,
        backup: fazerBackupUsuarios,
        
        // Função para executar apenas a migração (sem confirmações)
        executarSilencioso: executarMigracaoUsuarios,
        
        // Função para ver estatísticas dos usuários
        estatisticas: async function() {
            const snapshot = await db.ref('users').once('value');
            const usuarios = snapshot.val() || {};
            
            console.log('📊 ESTATÍSTICAS DOS USUÁRIOS:');
            console.log(`Total: ${Object.keys(usuarios).length}`);
            
            let comEmail = 0, comNome = 0, comTimestamp = 0;
            
            Object.values(usuarios).forEach(user => {
                if (user.email) comEmail++;
                if (user.name) comNome++;
                if (user.createdAt) comTimestamp++;
            });
            
            console.log(`Com email: ${comEmail}`);
            console.log(`Com nome: ${comNome}`);
            console.log(`Com timestamp: ${comTimestamp}`);
        }
    };
    
    console.log('📋 Script de migração carregado. Use migracaoUtils.executar() para iniciar.');
}

// Inicia a inicialização
inicializarSistemaMigracao();

// Exporta para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        executarMigracaoUsuarios,
        fazerBackupUsuarios,
        validarIntegridadeDados,
        iniciarMigracao
    };
}