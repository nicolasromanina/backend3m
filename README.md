# PrintPro Backend API

Backend complet pour l'application PrintPro - Gestion de services d'impression professionnelle.

## 🚀 Technologies

- **Node.js** + **Express.js** + **TypeScript**
- **MongoDB** avec **Mongoose**
- **JWT** pour l'authentification
- **Bcrypt** pour le hashage des mots de passe
- **Nodemailer** pour l'envoi d'emails
- **Multer** pour l'upload de fichiers
- **Winston** pour les logs
- **Express-validator** pour la validation
- **Helmet** + **CORS** pour la sécurité

## 📁 Structure du projet

```
backend/
├── src/
│   ├── config/
│   │   ├── db.ts              # Configuration MongoDB
│   │   └── env.ts             # Variables d'environnement
│   ├── controllers/
│   │   ├── auth.controller.ts # Authentification
│   │   ├── user.controller.ts # Gestion utilisateurs
│   │   ├── order.controller.ts# Gestion commandes
│   │   └── service.controller.ts # Gestion services
│   ├── interfaces/
│   │   ├── auth.interface.ts  # Types authentification
│   │   ├── user.interface.ts  # Types utilisateur
│   │   ├── order.interface.ts # Types commandes
│   │   └── team.interface.ts  # Types équipe
│   ├── middlewares/
│   │   ├── auth.middleware.ts # Authentification
│   │   ├── error.middleware.ts# Gestion erreurs
│   │   ├── validation.middleware.ts # Validation
│   │   └── upload.middleware.ts # Upload fichiers
│   ├── models/
│   │   ├── user.model.ts      # Modèle utilisateur
│   │   ├── service.model.ts   # Modèle service
│   │   ├── order.model.ts     # Modèle commande
│   │   └── team.model.ts      # Modèles équipe
│   ├── routes/
│   │   ├── auth.routes.ts     # Routes authentification
│   │   ├── user.routes.ts     # Routes utilisateur
│   │   ├── order.routes.ts    # Routes commandes
│   │   └── service.routes.ts  # Routes services
│   ├── services/
│   │   ├── auth.service.ts    # Services authentification
│   │   ├── user.service.ts    # Services utilisateur
│   │   └── email.service.ts   # Service email
│   ├── utils/
│   │   ├── apiError.ts        # Gestion erreurs API
│   │   ├── apiResponse.ts     # Réponses API standardisées
│   │   └── logger.ts          # Configuration logs
│   ├── templates/
│   │   └── emails/            # Templates emails HTML
│   └── app.ts                 # Application principale
├── uploads/                   # Dossier uploads
├── logs/                      # Logs de l'application
├── .env.example              # Variables d'environnement exemple
├── package.json
└── tsconfig.json
```

## 🛠️ Installation

1. **Cloner et installer les dépendances**
```bash
cd backend
npm install
```

2. **Configuration de l'environnement**
```bash
cp .env.example .env
# Éditer le fichier .env avec vos configurations
```

3. **Variables d'environnement requises**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/printpro
JWT_SECRET=your-super-secret-jwt-key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

4. **Démarrer l'application**
```bash
# Développement
npm run dev

# Production
npm run build
npm start
```

## 📚 API Endpoints

### 🔐 Authentification (`/api/auth`)
- `POST /register` - Inscription
- `POST /login` - Connexion
- `POST /logout` - Déconnexion
- `POST /refresh-token` - Rafraîchir le token
- `POST /forgot-password` - Mot de passe oublié
- `POST /reset-password` - Réinitialiser mot de passe
- `POST /verify-email` - Vérifier email
- `POST /change-password` - Changer mot de passe
- `GET /profile` - Profil utilisateur

### 👥 Utilisateurs (`/api/users`)
- `PUT /profile` - Mettre à jour profil
- `POST /avatar` - Upload avatar
- `DELETE /account` - Supprimer compte
- `GET /` - Liste utilisateurs (admin)
- `GET /stats` - Statistiques (admin)
- `GET /:id` - Utilisateur par ID (admin)
- `PUT /:id` - Modifier utilisateur (admin)
- `DELETE /:id` - Supprimer utilisateur (admin)

### 🛍️ Services (`/api/services`)
- `GET /` - Liste des services
- `GET /categories` - Catégories de services
- `GET /popular` - Services populaires
- `GET /search` - Rechercher services
- `GET /:id` - Service par ID
- `POST /calculate-price` - Calculer prix
- `POST /` - Créer service (admin)
- `PUT /:id` - Modifier service (admin)
- `DELETE /:id` - Supprimer service (admin)

### 📦 Commandes (`/api/orders`)
- `POST /` - Créer commande
- `GET /` - Liste commandes
- `GET /stats` - Statistiques commandes
- `GET /:id` - Commande par ID
- `PUT /:id` - Modifier commande
- `DELETE /:id` - Supprimer commande
- `POST /:id/quote` - Générer devis (admin)
- `POST /:id/invoice` - Générer facture (admin)

## 🔒 Sécurité

- **Authentification JWT** avec refresh tokens
- **Hashage bcrypt** des mots de passe (coût 12)
- **Rate limiting** (100 req/15min par défaut)
- **Helmet.js** pour les headers de sécurité
- **CORS** configuré
- **Validation** stricte des entrées
- **Sanitisation** des données

## 📧 Système d'emails

Templates HTML inclus pour :
- Email de bienvenue
- Vérification d'email
- Réinitialisation de mot de passe
- Confirmation de commande
- Mise à jour de statut

## 📊 Logging

- **Winston** pour les logs structurés
- Logs en fichiers (`logs/combined.log`, `logs/error.log`)
- Logs console en développement
- Rotation automatique des logs

## 🗄️ Base de données

### Modèles principaux :
- **User** - Utilisateurs avec rôles (client/admin/employee)
- **Service** - Services d'impression avec options
- **Order** - Commandes avec items et statuts
- **Employee** - Gestion d'équipe
- **Shift** - Planning des employés
- **Training** - Formations
- **Ticket** - Système de tickets
- **PerformanceReview** - Évaluations

### Index optimisés pour :
- Recherche par email, rôle, statut
- Tri par date de création
- Recherche textuelle sur services
- Performance des requêtes

## 🚀 Déploiement

1. **Build de production**
```bash
npm run build
```

2. **Variables d'environnement production**
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-production-secret
```

3. **Démarrage**
```bash
npm start
```

## 🧪 Tests et développement

```bash
# Linting
npm run lint
npm run lint:fix

# Tests (à implémenter)
npm test
```

## 📈 Monitoring

- Health check endpoint : `GET /health`
- Métriques système (uptime, mémoire, DB)
- Logs structurés pour monitoring

## 🔧 Fonctionnalités avancées

- **Upload de fichiers** avec validation
- **Génération PDF** (devis/factures)
- **Système de notifications**
- **Gestion d'équipe complète**
- **Statistiques et analytics**
- **Recherche avancée**
- **Cache et optimisations**

## 📞 Support

Pour toute question ou problème :
- 📧 Email : support@printpro.fr
- 📱 Téléphone : 01 23 45 67 89

---

**PrintPro Backend** - Solution complète pour la gestion de services d'impression professionnelle.