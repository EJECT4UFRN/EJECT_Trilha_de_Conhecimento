# 🔧 Sistema de Migração de Usuários - EJECT (Realtime Database)

## 📋 Visão Geral

Este sistema foi criado para atualizar a estrutura de dados dos usuários já cadastrados no **Firebase Realtime Database**, garantindo compatibilidade com o novo formato sem causar conflitos.

⚠️ **IMPORTANTE**: Este sistema é específico para Firebase **Realtime Database**, não Firestore.

## 🚨 IMPORTANTE - LEIA ANTES DE USAR

⚠️ **ATENÇÃO**: Esta ferramenta modifica dados no banco de produção. Use apenas se você tem:
- Permissões de administrador
- Conhecimento técnico adequado
- Backup recente dos dados

## 📁 Arquivos Criados

1. **`migracao-usuarios.js`** - Script principal de migração para Realtime Database
2. **`migracao-interface.html`** - Interface web administrativa
3. **`teste-realtime-database.html`** - Interface de teste e migração simplificada ⭐ **RECOMENDADO**
4. **`verificacao-compatibilidade.js`** - Script de análise prévia
5. **`INSTRUÇÕES-MIGRAÇÃO.md`** - Este arquivo de instruções

### 🎯 **Arquivo Recomendado para Usar**
**`teste-realtime-database.html`** - Interface simplificada e específica para Realtime Database

## 🎯 O que a Migração Faz

### ✅ Dados que são Atualizados/Adicionados:
- **`uid`** - ID único do usuário (se ausente)
- **`email`** - Email do usuário (preserva existente)
- **`name`** - Nome do usuário (usa email como fallback se ausente)
- **`createdAt`** - Timestamp de criação da conta
- **`lastLogin`** - Timestamp do último login

### 🧹 Dados que são Removidos:
- Campos desnecessários como `displayName`, `photoURL`, `phoneNumber`

### 🔒 Dados que são Preservados:
- Todos os dados existentes são mantidos
- Progresso das trilhas
- Configurações personalizadas

## 🚀 Como Usar

### ⭐ **Opção 1: Interface Simplificada (RECOMENDADA)**

1. **Abrir a Interface de Teste**:
   ```
   Abrir o arquivo: SIGAV/teste-realtime-database.html
   ```

2. **Fazer Login**:
   - Use uma conta de administrador
   - Aguarde o status mostrar "Autenticado"

3. **Testar Conexão**:
   - Clique em "🔍 Testar Conexão"
   - Verifique se aparece "Database Online"

4. **Ver Usuários**:
   - Clique em "� Listar Usuários"
   - Veja quantos usuários precisam de migração

5. **Executar Migração**:
   - Clique em "🚀 Executar Migração"
   - Confirme a operação
   - Aguarde a conclusão

### Opção 2: Interface Completa

1. **Abrir a Interface**:
   ```
   Abrir o arquivo: SIGAV/migracao-interface.html
   ```

2. **Seguir os mesmos passos** da Opção 1

### Opção 2: Console do Navegador

1. **Abrir qualquer página do SIGAV** que tenha Firebase configurado

2. **Abrir Console do Navegador** (F12)

3. **Carregar o Script**:
   ```javascript
   // Criar elemento script e carregar
   const script = document.createElement('script');
   script.src = './migracao-usuarios.js';
   document.head.appendChild(script);
   ```

4. **Executar Comandos**:
   ```javascript
   // Ver estatísticas
   migracaoUtils.estatisticas();
   
   // Fazer backup
   await migracaoUtils.backup();
   
   // Executar migração
   await migracaoUtils.executar();
   ```

## 📊 Estrutura de Dados

### ❌ Formato Antigo (Exemplo):
```json
{
  "users": {
    "uid123": {
      "email": "user@exemplo.com"
    }
  }
}
```

### ✅ Formato Novo (Após Migração):
```json
{
  "users": {
    "uid123": {
      "uid": "uid123",
      "email": "user@exemplo.com", 
      "name": "Nome do Usuário",
      "createdAt": 1697097600000,
      "lastLogin": 1697097600000
    }
  }
}
```

## 🔍 Validação e Monitoramento

### Durante a Migração:
- ✅ Backup automático é criado
- 📊 Progress em tempo real no console
- ⚠️ Erros são logados e não interrompem o processo
- 📋 Relatório final com estatísticas

### Após a Migração:
- 🔍 Validação automática da integridade
- 📈 Estatísticas atualizadas
- 💾 Backup disponível para rollback se necessário

## 🆘 Solução de Problemas

### ❌ "Firebase não inicializado"
**Solução**: Certifique-se de que `firebase-config.js` está carregado

### ❌ "Usuário não autenticado"
**Solução**: Faça login com uma conta válida antes de executar

### ❌ "Permissão negada"
**Solução**: Use uma conta com permissões de escrita no banco

### ❌ "Alguns usuários não foram atualizados"
**Solução**: 
1. Verifique os logs de erro
2. Execute a migração novamente (ela só atualizará os pendentes)
3. Corrija manualmente casos específicos

## 🔄 Rollback (Reverter Migração)

Se algo der errado, você pode restaurar o backup:

1. **Via Interface**:
   - Acesse Firebase Console
   - Vá para Realtime Database
   - Encontre o backup em `/backups/usuarios_{timestamp}`
   - Copie os dados de volta para `/users`

2. **Via Script** (Console do navegador):
   ```javascript
   // Listar backups disponíveis
   db.ref('backups').once('value').then(snap => {
     console.log(Object.keys(snap.val()));
   });
   
   // Restaurar backup específico
   const backupKey = 'usuarios_1697097600000'; // substitua pelo backup desejado
   db.ref('backups/' + backupKey + '/data').once('value').then(snap => {
     return db.ref('users').set(snap.val());
   }).then(() => {
     console.log('Backup restaurado com sucesso!');
   });
   ```

## 📞 Suporte

Se encontrar problemas:

1. **Verifique os logs** no console da interface
2. **Documente o erro** com prints/logs
3. **Não execute novamente** até resolver o problema
4. **Consulte um desenvolvedor** se necessário

## ✅ Checklist Pré-Migração

- [ ] Fiz login com conta de administrador
- [ ] Verifiquei as estatísticas dos usuários
- [ ] Criei um backup dos dados
- [ ] Executei uma validação dos dados
- [ ] Estou em um ambiente seguro (não produção, se possível)
- [ ] Tenho tempo para acompanhar o processo completo

## ✅ Checklist Pós-Migração

- [ ] Migração foi concluída com sucesso
- [ ] Validação da integridade passou
- [ ] Estatísticas mostram 0 usuários precisando migração
- [ ] Testei login com usuários migrados
- [ ] Backup foi criado e está acessível
- [ ] Documentei o processo e resultados

---

**⚠️ Lembrete Final**: Esta operação é irreversível na interface. Sempre mantenha backups atualizados!