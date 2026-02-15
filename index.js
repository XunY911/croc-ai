require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai");

// --- INITIALISATION DU SERVEUR ---
const app = express();
app.use(cors());       
app.use(express.json({ limit: '10mb' })); // Autorise les images lourdes

const MA_CLE_API = process.env.VENICE_API_KEY; 

if (!MA_CLE_API) {
  console.error("⚠️ ERREUR : Pas de clé API trouvée !");
}

const openai = new OpenAI({
  baseURL: "https://api.venice.ai/api/v1",
  apiKey: MA_CLE_API,
});

// --- OUTIL DE NETTOYAGE JSON ---
function nettoyerEtParserJSON(texteBrut) {
  const debut = texteBrut.indexOf('{');
  const fin = texteBrut.lastIndexOf('}');

  if (debut === -1 || fin === -1) {
    throw new Error("L'IA n'a pas renvoyé de format JSON valide.");
  }
  const jsonPropre = texteBrut.substring(debut, fin + 1);
  return JSON.parse(jsonPropre);
}

// =========================================================
// 🍳 FONCTIONNALITÉ 1 : CRÉATION DE RECETTE
// =========================================================
async function genererRecette(ingredients, imageBase64) {
  console.log(`🍳 Croc'Ai réfléchit... Image reçue : ${imageBase64 ? "OUI 📸" : "NON 📝"}`);

  try {
    const nomDuModele = imageBase64 ? "mistral-31-24b" : "llama-3.3-70b";

    let userMessage;
    if (imageBase64) {
      userMessage = [
        { type: "text", text: `Voici ce que j'ai : ${ingredients || "Regarde la photo et déduis les ingrédients."}` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ];
    } else {
      userMessage = `Voici ce que j'ai : ${ingredients}`;
    }

    const completion = await openai.chat.completions.create({
      model: nomDuModele, 
      messages: [
        {
          role: "system",
          content: `Tu es un chef étoilé Michelin expert en cuisine du quotidien.
          Ta mission : Créer une recette DÉLICIEUSE et PRÉCISE pour 2 personnes à partir des ingrédients donnés ou visibles sur l'image.
          
          RÈGLES IMPÉRATIVES :
          1. Identifie les ingrédients sur la photo si elle est fournie.
          2. Tu DOIS inventer des quantités précises (grammes, ml, nombre) pour CHAQUE ingrédient.
          3. Tu peux ajouter des ingrédients de base (sel, poivre, huile, eau, beurre, épices simples).
          4. Réponds UNIQUEMENT avec un JSON strict.

          Structure JSON attendue :
          {
            "titre": "Nom du plat (Donne envie !)",
            "description": "Description courte et appétissante",
            "temps_preparation": "15 min",
            "temps_cuisson": "20 min",
            "difficulte": "Facile/Moyen/Chef",
            "calories_estimees": 600,
            "ingredients_detailles": [
                "200g de Riz blanc",
                "2 filets de Poulet",
                "1 c.à.s d'Huile d'olive"
            ],
            "etapes": [
                "Couper le poulet en dés...",
                "Faire revenir dans l'huile..."
            ]
          }`
        },
        { role: "user", content: userMessage }
      ],
      temperature: 0.5, 
    });
    
    return nettoyerEtParserJSON(completion.choices[0].message.content);

  } catch (error) {
    console.error("❌ Erreur recette :", error.message);
    return null;
  }
}

app.post('/api/recette', async (req, res) => {
  const { ingredients, image } = req.body;

  if (!ingredients && !image) {
    return res.status(400).json({ error: "Il manque les ingrédients ou une photo !" });
  }

  const recette = await genererRecette(ingredients, image);

  if (recette) {
    console.log("✅ Recette envoyée !");
    res.json(recette);
  } else {
    res.status(500).json({ error: "Désolé, le chef a raté le plat. Réessayez." });
  }
});

// =========================================================
// ❄️ FONCTIONNALITÉ 2 : SCAN DU FRIGO VIRTUEL
// =========================================================
app.post('/api/scan-frigo', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Aucune image reçue !" });
  }

  console.log("📸 Scan du frigo en cours...");

  try {
    const completion = await openai.chat.completions.create({
      model: "mistral-31-24b", // Modèle spécial Vision
      messages: [
        {
          role: "system",
          content: "Tu es un assistant de cuisine. Regarde cette image et renvoie UNIQUEMENT une liste des ingrédients que tu reconnais, séparés par des virgules. Ne fais pas de phrases. Exemple: Tomates, Oeufs, Bouteille de Lait, Salade"
        },
        { 
          role: "user", 
          content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }] 
        }
      ],
      temperature: 0.2, // Très bas pour ne pas halluciner d'ingrédients
    });
    
    const reponseBrute = completion.choices[0].message.content;
    const listeIngredients = reponseBrute.split(',').map(item => item.trim()).filter(item => item.length > 0);
    
    console.log("✅ Ingrédients trouvés :", listeIngredients);
    res.json({ ingredients: listeIngredients });

  } catch (error) {
    console.error("❌ Erreur scan frigo :", error.message);
    res.status(500).json({ error: "Erreur lors de l'analyse visuelle." });
  }
});

// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Croc'Ai prêt sur le port ${PORT}`);
});