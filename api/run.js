const express = require("express");
require("dotenv").config();
const axios = require("axios");
const pdf = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 8000;
app.use(express.json());

// Setup Gemini
const key = process.env.GEMINI_API_KEY;
console.log(key);
const genAI = new GoogleGenerativeAI(key);

// Function to fetch and extract text from PDF URL
async function extractTextFromPDF(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const data = await pdf(response.data);
  return data.text;
}

// POST: /hackrx/run
app.post("/hackrx/run", async (req, res) => {
  const { documents, questions } = req.body;

  if (typeof documents !== "string" || !Array.isArray(questions)) {
    return res.status(400).json({
      error:
        'Invalid input. Expected a string "documents" and an array of "questions".',
    });
  }

  try {
    // Step 1: Extract text from PDF
    const documentText = await extractTextFromPDF(documents);

    // Step 2: Create Gemini prompt
    const prompt = `You are an intelligent assistant. Use the following document to answer the given questions.

    Document:
    ${documentText}

    Questions:
    ${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

    Provide clear and concise answers. Do not mark up and give in a single sentence using numbers where possible. Number them accordingly.`;

    // Step 3: Call Gemini Pro
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawOutput = response.text();

    // Step 4: Optional – parse answers
    const answers = questions.map((_, i) => {
      const match = rawOutput.match(new RegExp(`${i + 1}\\.\\s*(.*)`));
      return match ? match[1].trim() : "No answer found.";
    });

    res.json({ answers, rawOutput }); // Send both raw + parsed
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to process PDF and generate answers." });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
