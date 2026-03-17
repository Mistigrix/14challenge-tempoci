# TempoCI

Chronomètre et minuteur minimaliste — Jour 3 du **Challenge 14-14-14**.

Conçu en HTML5, CSS3 et JavaScript pur, sans aucun framework.

---

## Aperçu

TempoCI propose deux outils en un :

- **Chronomètre** — démarrage, pause, tours (lap) avec détection automatique du meilleur et du pire tour
- **Minuteur** — saisie libre (H/M/S), préréglages rapides (1 à 30 min), cercle de progression, alerte visuelle en fin de décompte

Le tout avec un mode clair / sombre et des micro-interactions sur chaque bouton.

---

## Structure

```
14challenge-tempoci/
├── index.html        # Point d'entrée
├── css/
│   └── main.css      # Styles (CSS3, custom properties pour le thème)
└── js/
    └── app.js        # Logique applicative (Vanilla JS)
```

---

## Stack

| Technologie | Usage |
|---|---|
| HTML5 | Structure sémantique |
| CSS3 | Mise en page, animations, thème clair/sombre via custom properties |
| JavaScript (Vanilla) | Chrono, minuteur, rendu dynamique, gestion d'état |

Aucun framework, aucune dépendance.

---

## Lancer le projet

Ouvrir `index.html` directement dans un navigateur :

```bash
open index.html
# ou double-clic sur le fichier
```

Aucune installation ni compilation requise.

---

## Fonctionnalités

### Chronomètre
- Lancer / Pause / Reprendre / Reset
- Enregistrement de tours (Lap) avec affichage cumulé
- Meilleur tour mis en vert, pire tour mis en rouge
- Arc SVG animé (une révolution = 60 secondes)

### Minuteur
- Saisie par spinners (heures, minutes, secondes)
- Préréglages : 1, 3, 5, 10, 15 et 30 minutes
- Cercle de progression qui se remplit au fil du décompte
- Notification visuelle (rouge + animation pulse) à la fin
- Lancer / Pause / Reprendre / Reset

### Thème
- Basculement clair/sombre via le bouton ☽ / ☀ dans la barre de navigation
- Transitions douces sur tous les éléments

---

## Équipe

| Nom | Rôle |
|---|---|
| Bath Dorgeles | Chef de projet & Front |
| Oclin Marcel C. | Dev Front-end |
| Rayane Irie | Back-end |

---

## Challenge 14-14-14

Ce projet s'inscrit dans le **Challenge 14-14-14** : 14 jours, 14 projets, 14 personnes.
Chaque projet est open source et publié sur [225os.com](https://225os.com) et GitHub.

---

*Jour 3 — Mars 2026*
