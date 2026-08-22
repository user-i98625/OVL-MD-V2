<h1 align="center">OVL-MD-V2</h1>

<p align="center">
    <img alt="OVL" src="https://files.catbox.moe/gxcb9p.jpg">
</p>

<p align="center">
    Un bot WhatsApp multi-appareil. N'oubliez pas de laisser une ⭐ (star) pour le projet.
</p>

<p align="center">
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="MIT License" />
    </a>
    <a href="https://github.com/WhiskeySockets/Baileys">
        <img src="https://img.shields.io/badge/Baileys-Web%20API-orange?style=flat-square" alt="Using Baileys Web API" />
    </a>
    <a href="https://github.com/Ainz-devs/OVL-MD-V2/stargazers">
        <img src="https://img.shields.io/github/stars/Ainz-devs/OVL-MD-V2?style=flat-square" alt="Stars" />
    </a>
    <a href="https://github.com/Ainz-devs/OVL-MD-V2/network/members">
        <img src="https://img.shields.io/github/forks/Ainz-devs/OVL-MD-V2?style=flat-square" alt="Forks" />
    </a>
</p>

---

<details>
  <summary>🚀 Déploiement de OVL-MD-V2</summary>

### 🧬 Étape 1 : Fork du dépôt GitHub  
[![Fork GitHub](https://img.shields.io/badge/Fork%20le%20Repo-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ainz-devs/OVL-MD-V2/fork)

---

### 🔐 Étape 2 : Générer une SESSION ID

📌 **Conserve la Session-ID dans un endroit sécurisé.** 

[![Obtenir SESSION-ID](https://img.shields.io/badge/Obtenir%20SESSION--ID-0A0A0A?style=for-the-badge&logo=key&logoColor=white)](https://ovl-web.koyeb.app/)  

---

### 🗄️ Étape 3 : Créer une base de données  (au choix)
[![Créer Base de Données](https://img.shields.io/badge/Supabase-Base%20de%20donn%C3%A9es-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

### 🚀 Étape 4 : Méthodes de déploiement

#### <img src="https://img.shields.io/badge/Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white" height="28" />
- Créez un compte : [Lien Heroku](https://signup.heroku.com/)
- Déploiement rapide : [Déployer sur Heroku](https://dashboard.heroku.com/new?template=https://github.com/Ainz-devs/OVL-MD-V2)

#### <img src="https://img.shields.io/badge/Render-12100E?style=for-the-badge&logo=render&logoColor=white" height="28" />
- Créez un compte : [Lien Render](https://dashboard.render.com/register)
- Déploiement rapide : [Déployer sur Render](https://dashboard.render.com/web/new)

#### <img src="https://img.shields.io/badge/Koyeb-000000?style=for-the-badge&logo=koyeb&logoColor=white" height="28" />
- Créez un compte : [Lien Koyeb](https://app.koyeb.com/auth/signup)
- Déploiement rapide : [Déployer sur Koyeb](https://app.koyeb.com/deploy?type=git&name=ovl-md&repository=https%3A%2F%2Fgithub.com%2FAinz-devs%2FOVL-MD-V2&branch=main&builder=dockerfile&instance_type=free&env%5BPREFIXE%5D=.&env%5BNOM_OWNER%5D=Ainz&env%5BNUMERO_OWNER%5D=226xxxxxxxx&env%5BMODE%5D=public&env%5BSESSION_ID%5D=&env%5BSTICKER_PACK_NAME%5D=%E1%B4%8F%E1%B4%A0%CA%9F-%E1%B4%8D%E1%B4%85-%E1%B4%A0%F0%9D%9F%B8&env%5BSTICKER_AUTHOR_NAME%5D=%E1%B4%80%C9%AA%C9%B4%E1%B4%A2%F0%9F%94%85%E2%9C%A8&env%5BNOM_BOT%5D=%F0%9F%A4%96+OVL-MD+BOT+V2)

#### <img src="https://img.shields.io/badge/Panel-grey?style=for-the-badge&logo=windows-terminal&logoColor=white" height="28" />
- Créez un serveur
- Ajoutez le fichier `index.js` ou `main.js`
- Démarrez le bot

#### <img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" height="28" />
- Ajoutez un fichier `.env`
- Créez le fichier `.github/workflows/deploy.yml`

</details>

---

<details>
  <summary>📝 Fichier index.js ou main.js pour déploiement sur panel</summary>

```js
const { spawnSync, spawn } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');

// Ajoutez ici vos variables d'environnement
const env_file = ``;

if (!env_file.trim()) {
  console.error("❌ 'env_file' est vide. Veuillez renseigner vos variables d'environnement avant de lancer le script.");
  process.exit(1);
}

let crashCount = 0;
const crashLimit = 5;
let lastCrashTime = Date.now();
const crashResetDelay = 30000;

function setupProject() {
  if (!existsSync('ovl')) {
    const clone = spawnSync('git', ['clone', 'https://github.com/Ainz-devs/OVL-MD-V2', 'ovl'], { stdio: 'inherit' });
    if (clone.status !== 0) process.exit(1);
  }

  if (!existsSync('ovl/.env')) {
    mkdirSync('ovl', { recursive: true });
    writeFileSync('ovl/.env', env_file);
    console.log("✅ Fichier .env créé avec succès.");
  }

  const install = spawnSync('npm', ['install'], { cwd: 'ovl', stdio: 'inherit' });
  if (install.status !== 0) process.exit(1);
}

function validateSetup() {
  if (!existsSync('ovl/package.json')) {
    process.exit(1);
  }

  const check = spawnSync('npm', ['ls'], { cwd: 'ovl', stdio: 'ignore' });

  if (check.status !== 0) {
    const reinstall = spawnSync('npm', ['install'], { cwd: 'ovl', stdio: 'inherit' });
    if (reinstall.status !== 0) {
      process.exit(1);
    }
  }
}

function launchApp() {
  const pm2 = spawn('npx', ['pm2', 'start', 'Ovl.js', '--name', 'ovl-md', '--attach'], {
    cwd: 'ovl',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let restartAttempts = 0;

  pm2.stdout?.on('data', (chunk) => {
    const output = chunk.toString();
    console.log(output);
    if (output.includes('Connexion') || output.includes('ready')) {
      restartAttempts = 0;
    }
  });

  pm2.stderr?.on('data', (chunk) => {
    const output = chunk.toString();
    if (output.includes('restart')) {
      restartAttempts++;
      if (restartAttempts > 3) {
        spawnSync('npx', ['pm2', 'delete', 'ovl-md'], { cwd: 'ovl', stdio: 'inherit' });
        startNodeFallback();
      }
    }
  });

  pm2.on('exit', () => {
    startNodeFallback();
  });

  pm2.on('error', () => {
    startNodeFallback();
  });
}

function startNodeFallback() {
  const child = spawn('node', ['Ovl.js'], { cwd: 'ovl', stdio: 'inherit' });

  child.on('exit', (code) => {
    const now = Date.now();
    if (now - lastCrashTime > crashResetDelay) crashCount = 0;
    crashCount++;
    lastCrashTime = now;

    if (crashCount > crashLimit) {
      return;
    }

    startNodeFallback();
  });
}

setupProject();
validateSetup();
launchApp();
```

</details>

---

<details>
  <summary>⚙️ Fichier .github/workflows/deploy.yml</summary>

```yaml
name: OVL-MD Bot CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */5 * * *'

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: |
          sudo apt update
          sudo apt install -y ffmpeg
          npm i
      - run: timeout 18300s npm run Ovl
```

</details>

---

<details>
  <summary>🔐 Exemple de fichier .env</summary>

```env
PREFIXE=.
NOM_OWNER=Ainz
NUMERO_OWNER=226xxxxxxxx
MODE=public
SESSION_ID=
STICKER_PACK_NAME=ᴏᴠʟ-ᴍᴅ-ᴠ𝟸
STICKER_AUTHOR_NAME=ᴀɪɴᴢ🔅✨
NOM_BOT=🤖 OVL-MD BOT V2
```

</details>

---

### 🎮 Jeux et quiz de groupe

Le bot inclut désormais des jeux jouables à plusieurs dans un groupe : `.pendu` et `.anagramme`. Les quizz se lancent avec `.quizz-anime`, `.quizz-gaming`, `.quizz-cultire-g` ou `.quizz-foot` ; `.quizz-culture-g` et les anciens noms restent également acceptés comme alias. Après le lancement, la personne qui a lancé le quizz choisit 1, 2 ou 3 pour jouer respectivement 10, 20 ou 30 questions. Tout le groupe répond ensuite uniquement avec 1, 2, 3 ou 4. Chaque question reste ouverte 10 secondes, la bonne réponse est révélée brièvement et la suivante arrive après 2 secondes. Utilise `.jeux` pour afficher l’aide, `.scorejeux` pour consulter le classement et `.stopjeu` pour arrêter une partie. Les parties et les scores sont conservés en mémoire et sont réinitialisés lors d’un redémarrage du bot.

### 🧞 Akinator

La commande `.akinator` lance une partie Akinator en français dans un groupe. Les participants répondent avec `1` pour Oui, `2` pour Non, `3` pour Je ne sais pas, `4` pour Probablement oui ou `5` pour Probablement non. Quand Akinator propose un personnage, le groupe répond `oui` ou `non`. Le créateur, un administrateur ou un sudo peut envoyer `stop`, `.stopakinator` ou utiliser `.stopakinator` pour arrêter la partie. Une seule partie Akinator peut être active par groupe.

### 🌍 Rejoins la Communauté OVL

[![WhatsApp Support](https://img.shields.io/badge/Support%20WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://chat.whatsapp.com/BP1oOMh0QvR7H3vvO9bRYK)
[![Telegram Channel](https://img.shields.io/badge/Canal%20Telegram-229ED9?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ovlmd_tlg)
[![WhatsApp Channel](https://img.shields.io/badge/Channel%20WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VayTmvxHltYGCm0J7P0A)

Partage, pose tes questions, et reste à jour avec toutes les nouveautés du projet !

---

### 👨‍💻 Développeur Principal
- **Ainz**
---
### 🙌 Remerciements
- Haibo_lugh – pour son soutien et aide dans la gestion du bot au support.
- Nathan Harmone – pour ses tutoriels YouTube.
- Dr Djibi – pour son soutien.
---
### 📄 Licence

Distribué sous la licence MIT. Voir le fichier [LICENSE](./LICENSE) pour plus d’informations.
