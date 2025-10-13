/**
 * Exemplo de como acessar os dados dos usuários salvos no Firebase Realtime Database
 * 
 * Estrutura dos dados no banco:
 * users/
 *   {uid}/
 *     name: "Nome do Usuário"
 *     email: "email@exemplo.com"
 *     uid: "identificador_único"
 *     createdAt: timestamp
 *     lastLogin: timestamp
 */

// Função para buscar dados de um usuário específico pelo UID
function buscarUsuarioPorUID(uid) {
    return db.ref('users/' + uid).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                console.log('Dados do usuário:', userData);
                return userData;
            } else {
                console.log('Usuário não encontrado');
                return null;
            }
        })
        .catch((error) => {
            console.error('Erro ao buscar usuário:', error);
            throw error;
        });
}

// Função para buscar o usuário atualmente logado
function buscarUsuarioAtual() {
    const user = auth.currentUser;
    if (user) {
        return buscarUsuarioPorUID(user.uid);
    } else {
        console.log('Nenhum usuário logado');
        return Promise.resolve(null);
    }
}

// Função para listar todos os usuários (para administradores)
function listarTodosUsuarios() {
    return db.ref('users').once('value')
        .then((snapshot) => {
            const usuarios = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
                    usuarios.push({
                        uid: childSnapshot.key,
                        ...userData
                    });
                });
            }
            console.log('Total de usuários:', usuarios.length);
            return usuarios;
        })
        .catch((error) => {
            console.error('Erro ao listar usuários:', error);
            throw error;
        });
}

// Função para buscar usuário por email
function buscarUsuarioPorEmail(email) {
    return db.ref('users').orderByChild('email').equalTo(email).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = Object.values(snapshot.val())[0];
                console.log('Usuário encontrado:', userData);
                return userData;
            } else {
                console.log('Usuário com email', email, 'não encontrado');
                return null;
            }
        })
        .catch((error) => {
            console.error('Erro ao buscar usuário por email:', error);
            throw error;
        });
}

// Função para buscar usuários por nome (busca parcial)
function buscarUsuariosPorNome(nome) {
    return db.ref('users').once('value')
        .then((snapshot) => {
            const usuariosEncontrados = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
                    if (userData.name && userData.name.toLowerCase().includes(nome.toLowerCase())) {
                        usuariosEncontrados.push({
                            uid: childSnapshot.key,
                            ...userData
                        });
                    }
                });
            }
            console.log('Usuários encontrados:', usuariosEncontrados.length);
            return usuariosEncontrados;
        })
        .catch((error) => {
            console.error('Erro ao buscar usuários por nome:', error);
            throw error;
        });
}

// Função para atualizar dados do usuário
function atualizarDadosUsuario(uid, novosDados) {
    return db.ref('users/' + uid).update(novosDados)
        .then(() => {
            console.log('Dados atualizados com sucesso');
            return true;
        })
        .catch((error) => {
            console.error('Erro ao atualizar dados:', error);
            throw error;
        });
}

// Exemplos de uso:

// 1. Buscar dados do usuário atual
auth.onAuthStateChanged((user) => {
    if (user) {
        buscarUsuarioAtual().then((userData) => {
            if (userData) {
                console.log('Bem-vindo,', userData.name);
                console.log('Email:', userData.email);
                console.log('Conta criada em:', new Date(userData.createdAt));
                console.log('Último login:', new Date(userData.lastLogin));
            }
        });
    }
});

// 2. Buscar um usuário específico
// buscarUsuarioPorUID('uid_do_usuario');

// 3. Buscar por email
// buscarUsuarioPorEmail('usuario@exemplo.com');

// 4. Buscar por nome
// buscarUsuariosPorNome('João');

// 5. Listar todos os usuários (apenas para administradores)
// listarTodosUsuarios();

// 6. Atualizar dados do usuário atual
/*
auth.onAuthStateChanged((user) => {
    if (user) {
        atualizarDadosUsuario(user.uid, {
            ultimoAcesso: firebase.database.ServerValue.TIMESTAMP,
            navegador: navigator.userAgent
        });
    }
});
*/

// Exporta as funções para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buscarUsuarioPorUID,
        buscarUsuarioAtual,
        listarTodosUsuarios,
        buscarUsuarioPorEmail,
        buscarUsuariosPorNome,
        atualizarDadosUsuario
    };
}