require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai");
const path = require('path');

// --- INITIALISATION DU SERVEUR ---
const app = express();
app.use(cors());       // Autorise l'app mobile/web
app.use(express.json()); // Autorise la lecture des données envoyées
app.use(express.static(path.join(__dirname, 'public'))); // Sert le fichier HTML

// Au lieu de la clé en dur, on dit au serveur : "Va chercher la clé dans le coffre-fort (Variables d'environnement)"
const MA_CLE_API = process.env.VENICE_API_KEY; 

// Si la clé n'est pas trouvée (par exemple en local sans configuration), on prévient
if (!MA_CLE_API) {
  console.error("⚠️ ERREUR : Pas de clé API trouvée !");
}

const openai = new OpenAI({
  baseURL: "https://api.venice.ai/api/v1",
  apiKey: MA_CLE_API,
});

// --- OUTIL DE NETTOYAGE (LE CHIRURGIEN) ---
function nettoyerEtParserJSON(texteBrut) {
  const debut = texteBrut.indexOf('{');
  const fin = texteBrut.lastIndexOf('}');

  if (debut === -1 || fin === -1) {
    throw new Error("L'IA n'a pas renvoyé de format JSON valide.");
  }

  const jsonPropre = texteBrut.substring(debut, fin + 1);
  return JSON.parse(jsonPropre);
}

// --- LA LOGIQUE DU CHEF (VERSION PRÉCISE) ---
async function genererRecette(ingredients) {
  console.log(`🍳 Croc'Ai réfléchit pour : ${ingredients}...`);

  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b", // Très bon modèle pour suivre des instructions complexes
      messages: [
        {
          role: "system",
          content: `Tu es un chef étoilé Michelin expert en cuisine du quotidien.
          Ta mission : Créer une recette DÉLICIEUSE et PRÉCISE pour 2 personnes à partir des ingrédients donnés.
          
          RÈGLES IMPÉRATIVES :
          1. Tu DOIS inventer des quantités précises (grammes, ml, nombre) pour CHAQUE ingrédient. Ne dis pas juste "du riz", dis "150g de riz".
          2. Tu peux ajouter des ingrédients de base (sel, poivre, huile, eau, beurre, épices simples) si nécessaire pour le goût.
          3. Réponds UNIQUEMENT avec un JSON strict.

          Structure JSON attendue :
          {
            "titre": "Nom du plat (Donne envie !)",
            "description": "Description courte et appétissante",
            "temps_preparation": "ex: 15 min",
            "temps_cuisson": "ex: 20 min",
            "difficulte": "Facile/Moyen",
            "calories_estimees": 600,
            "ingredients_detailles": [
                "200g de Riz blanc",
                "2 filets de Poulet",
                "1 c.à.s d'Huile d'olive",
                "1 pincée de Sel",
                "10cl de Crème liquide"
            ],
            "etapes": [
                "Couper le poulet en dés...",
                "Faire revenir dans l'huile..."
            ]
          }`
        },
        { role: "user", content: `Voici ce que j'ai : ${ingredients}` }
      ],
      temperature: 0.5, // Créativité moyenne pour rester précis sur les quantités
    });
    
    const reponseBrute = completion.choices[0].message.content;
    const recetteFinale = nettoyerEtParserJSON(reponseBrute);
    return recetteFinale;

  } catch (error) {
    console.error("❌ Erreur lors de la génération :", error.message);
    return null;
  }
}

// --- ROUTE API ---
app.post('/api/recette', async (req, res) => {
  const { ingredients } = req.body;

  if (!ingredients) {
    return res.status(400).json({ error: "Il manque les ingrédients !" });
  }

  const recette = await genererRecette(ingredients);

  if (recette) {
    console.log("✅ Recette envoyée !");
    res.json(recette);
  } else {
    res.status(500).json({ error: "Désolé, le chef a raté le plat. Réessayez." });
  }
});

// 👇 CHANGEMENT ICI : On utilise le port donné par Render OU 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Croc'Ai prêt sur le port ${PORT}`);
});