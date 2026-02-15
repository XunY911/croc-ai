require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai");

const app = express();
app.use(cors());       
app.use(express.json({ limit: '10mb' }));

const MA_CLE_API = process.env.VENICE_API_KEY; 
const openai = new OpenAI({ baseURL: "https://api.venice.ai/api/v1", apiKey: MA_CLE_API });

function nettoyerEtParserJSON(texteBrut) {
  const debut = texteBrut.indexOf('{');
  const fin = texteBrut.lastIndexOf('}');
  if (debut === -1 || fin === -1) throw new Error("Format JSON invalide.");
  return JSON.parse(texteBrut.substring(debut, fin + 1));
}

// 🍳 1. CRÉATION DE RECETTE (Inchangé)
app.post('/api/recette', async (req, res) => {
  const { ingredients, image } = req.body;
  if (!ingredients && !image) return res.status(400).json({ error: "Manque d'infos" });

  try {
    const nomDuModele = image ? "mistral-31-24b" : "llama-3.3-70b";
    let userMessage = image 
      ? [{ type: "text", text: `Voici ce que j'ai : ${ingredients}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }]
      : `Voici ce que j'ai : ${ingredients}`;

    const completion = await openai.chat.completions.create({
      model: nomDuModele, 
      messages: [
        {
          role: "system",
          content: `Tu es un chef étoilé Michelin. Crée une recette DÉLICIEUSE. RÈGLES IMPÉRATIVES :
          1. Invente des quantités précises.
          2. Réponds UNIQUEMENT avec un JSON strict contenant: "titre", "description", "temps_preparation", "temps_cuisson", "difficulte", "calories_estimees", "ingredients_detailles" (liste), "etapes" (liste).`
        },
        { role: "user", content: userMessage }
      ],
      temperature: 0.5, 
    });
    res.json(nettoyerEtParserJSON(completion.choices[0].message.content));
  } catch (error) {
    res.status(500).json({ error: "Désolé, le chef a raté." });
  }
});

// ❄️ 2. SCAN DU FRIGO (Règles durcies contre le plastique !)
app.post('/api/scan-frigo', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "Aucune image reçue !" });

  try {
    const completion = await openai.chat.completions.create({
      model: "mistral-31-24b",
      messages: [
        {
          role: "system",
          // ✨ INSTRUCTION ULTRA STRICTE ICI
          content: "Tu es un assistant de cuisine. Regarde cette image et renvoie UNIQUEMENT une liste des ingrédients COMESTIBLES que tu reconnais. NE LISTE STRICTEMENT AUCUN OBJET, ni plastique, ni emballage, ni tupperware, ni verre. Uniquement la nourriture. Séparés par des virgules. Exemple: Tomates, Oeufs, Lait"
        },
        { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }] }
      ],
      temperature: 0.1, 
    });
    
    const listeIngredients = completion.choices[0].message.content.split(',').map(i => i.trim()).filter(i => i.length > 0);
    res.json({ ingredients: listeIngredients });
  } catch (error) {
    res.status(500).json({ error: "Erreur analyse visuelle." });
  }
});

// 🛡️ 3. NOUVEAU : LE VIDEUR ANTI-TROLL
app.post('/api/valider-ingredient', async (req, res) => {
  const { ingredient } = req.body;
  if (!ingredient) return res.status(400).json({ error: "Aucun ingrédient" });

  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b", // On utilise Llama car il est rapide et logique
      messages: [
        {
          role: "system",
          content: "Tu es un videur de frigo intransigeant. L'utilisateur veut ajouter un mot dans son frigo. Réponds UNIQUEMENT par 'OUI' si c'est un aliment ou une boisson COMESTIBLE. Réponds UNIQUEMENT par 'NON' si c'est un objet (plastique, métal, meuble), une insulte, ou du charabia."
        },
        { role: "user", content: ingredient }
      ],
      temperature: 0.1,
    });
    
    const reponse = completion.choices[0].message.content.trim().toUpperCase();
    if (reponse.includes("OUI")) {
      res.json({ valide: true });
    } else {
      res.json({ valide: false }); // C'est du plastique ou autre chose !
    }
  } catch (error) {
    res.json({ valide: true }); // Si le serveur bug, on laisse passer par pitié
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur prêt !`));