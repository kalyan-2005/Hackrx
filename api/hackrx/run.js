const axios = require("axios");
const pdf = require("pdf-parse");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractTextFromPDF(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const data = await pdf(response.data);
  return data.text;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { documents, questions } = req.body;

  if (typeof documents !== "string" || !Array.isArray(questions)) {
    return res.status(400).json({
      error: 'Expected a string "documents" and an array of "questions".',
    });
  }

  try {
    const documentText = await extractTextFromPDF(documents);

    const prompt = `You are an intelligent assistant. Use the following document to answer the given questions.

    Document:
    ${documentText}

    Questions:
    ${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

    Provide clear and concise answers. Do not mark up and give in a single sentence using numbers where ever possible. Number them accordingly.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawOutput = response.text();

    const answers = questions.map((_, i) => {
      const match = rawOutput.match(new RegExp(`${i + 1}\\.\\s*(.*)`));
      return match ? match[1].trim() : "No answer found.";
    });

    res.status(200).json({ answers });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error: "Failed to process PDF and generate answers.",
    });
  }
};
