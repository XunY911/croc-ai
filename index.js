require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai");
const path = require('path');

// --- INITIALISATION DU SERVEUR ---
const app = express();
app.use(cors());       
// ✨ CHANGEMENT 1 : On autorise les gros fichiers (jusqu'à 10 Mo) pour laisser passer les photos !
app.use(express.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public'))); 

const MA_CLE_API = process.env.VENICE_API_KEY; 

if (!MA_CLE_API) {
  console.error("⚠️ ERREUR : Pas de clé API trouvée !");
}

const openai = new OpenAI({
  baseURL: "https://api.venice.ai/api/v1",
  apiKey: MA_CLE_API,
});

function nettoyerEtParserJSON(texteBrut) {
  const debut = texteBrut.indexOf('{');
  const fin = texteBrut.lastIndexOf('}');

  if (debut === -1 || fin === -1) {
    throw new Error("L'IA n'a pas renvoyé de format JSON valide.");
  }
  const jsonPropre = texteBrut.substring(debut, fin + 1);
  return JSON.parse(jsonPropre);
}

// ✨ CHANGEMENT 2 : La fonction accepte maintenant une image (en Base64)
async function genererRecette(ingredients, imageBase64) {
  console.log(`🍳 Croc'Ai réfléchit... Image reçue : ${imageBase64 ? "OUI 📸" : "NON 📝"}`);

  try {
    // Si on a une image, on utilise le modèle Llama Vision. Sinon on garde ton super modèle texte.
    const nomDuModele = imageBase64 ? "mistral-31-24b" : "llama-3.3-70b";

    // ✨ CHANGEMENT 3 : On prépare le message. Si y'a une image, on la met dans un format spécial.
    let userMessage;
    if (imageBase64) {
      userMessage = [
        { type: "text", text: `Voici ce que j'ai : ${ingredients || "Rien de précisé, regarde la photo et déduis les ingrédients."}` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } } // C'est ici qu'on donne les yeux à l'IA
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
          3. Tu peux ajouter des ingrédients de base (sel, poivre, huile, eau, beurre, épices simples) si nécessaire pour le goût.
          4. Réponds UNIQUEMENT avec un JSON strict.

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
  // On récupère maintenant les ingrédients ET l'image potentielle
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Croc'Ai prêt sur le port ${PORT}`);
});