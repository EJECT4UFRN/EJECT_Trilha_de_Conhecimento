# 🔒 Regras Temporárias para Migração - educhior@hotmail.com

## 📋 Situação Atual
Suas regras atuais são muito específicas e não permitem a migração completa dos usuários. 

## 🛠️ Solução: Regras Temporárias

### **1. Substitua TEMPORARIAMENTE suas regras por:**

```json
{
  "rules": {
    "users": {
      // Um admin pode ler todos os dados dos usuários.
      ".read": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      
      "$uid": {
        // Um usuário pode ler seus próprios dados.
        ".read": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",

        // TEMPORÁRIO: Admin pode escrever em qualquer usuário para migração
        ".write": "$uid === auth.uid || auth.token.email === 'educhior@hotmail.com'",

        // Mantém regras específicas para produção (após migração)
        "name": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        },
        "email": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        },
        "progress": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        }
      }
    },
    "admins": {
      ".read": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      ".write": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      
      "$uid": {
        ".read": "$uid === auth.uid"
      }
    },
    // NOVO: Permite backup durante migração
    "backups": {
      ".read": "auth.token.email === 'educhior@hotmail.com'",
      ".write": "auth.token.email === 'educhior@hotmail.com'"
    }
  }
}
```

### **2. Execute a migração**

1. Faça login com `educhior@hotmail.com`
2. Abra `migracao-simples.html`
3. Execute a migração

### **3. VOLTE para as regras originais**

Após a migração bem-sucedida, volte para suas regras originais:

```json
{
  "rules": {
    "users": {
      ".read": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      
      "$uid": {
        ".read": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",

        // VOLTA À REGRA ORIGINAL
        ".write": "$uid === auth.uid",

        "name": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        },
        "email": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        },
        "progress": {
          ".write": "$uid === auth.uid || root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'"
        }
      }
    },
    "admins": {
      ".read": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      ".write": "root.child('admins').child(auth.uid).exists() || auth.token.email === 'educhior@hotmail.com'",
      
      "$uid": {
        ".read": "$uid === auth.uid"
      }
    },
    // OPCIONAL: Manter backups ou remover se não precisar
    "backups": {
      ".read": "auth.token.email === 'educhior@hotmail.com'",
      ".write": "auth.token.email === 'educhior@hotmail.com'"
    }
  }
}
```

## ⚡ Processo Rápido

1. **Copie as regras temporárias** → Firebase Console → Realtime Database → Regras
2. **Execute migração** → `migracao-simples.html`
3. **Restaure regras originais** → Firebase Console

## 🔍 Alternative: Migração Manual

Se preferir não alterar as regras, você pode:

1. **Fazer login como cada usuário individualmente**
2. **Executar um script que adiciona os campos faltantes**
3. **Ou adicionar os campos manualmente no Firebase Console**

## 📞 Suporte

- A migração adicionará apenas: `uid`, `name` (se faltando), `createdAt`, `lastLogin`
- Nenhum dado existente será perdido
- O processo é seguro e reversível

---

**⚠️ IMPORTANTE: Use as regras temporárias apenas durante a migração!**