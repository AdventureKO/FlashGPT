// Import necessary modules
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai'); // Import OpenAI library
const cors = require('cors');
require('dotenv').config(); // Load environment variables

const app = express();
app.use(cors());

// Multer setup for memory storage (store file in memory instead of disk)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Load API key from .env file
});

// Function to parse flashcards string and extract questions and answers
function parseFlashcards(flashcardsText) {
  // Split the flashcards based on the pattern '**Flashcard N**'
  const flashcardsArray = flashcardsText.split('**Flashcard').slice(1); // The first split is empty

  const formattedFlashcards = [];

  // Process each flashcard
  flashcardsArray.forEach(flashcard => {
    // Extract the question and answer by using regex
    const questionMatch = flashcard.match(/Q:\s(.*?)(?=\nA:)/); // Match the question after "Q:"
    const answerMatch = flashcard.match(/A:\s(.*?)(?=\n|$)/); // Match the answer after "A:"

    if (questionMatch && answerMatch) {
      const question = questionMatch[1].trim();
      const answer = answerMatch[1].trim();

      // Push the extracted question and answer into the result array
      formattedFlashcards.push({
        question: question,
        answer: answer
      });
    }
  });

  return formattedFlashcards;
}

// Endpoint to handle PDF upload
app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    // Use the file buffer from multer (req.file.buffer) to parse the PDF
    const pdfData = await pdfParse(req.file.buffer);

    // Extract the text from the PDF
    const text = pdfData.text;
    console.log('Extracted Text from PDF:', text); // Optional: Log the extracted text

    // Construct the prompt for OpenAI
    const prompt = `Create flashcards in question-answer pairs from the following text:\n\n${text}`;

    // Call OpenAI API for chat completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use the appropriate model (e.g., "gpt-4" or "gpt-3.5-turbo")
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract token usage data from response
    if (response.usage) {
      console.log(`Input tokens: ${response.usage.prompt_tokens}`);
      console.log(`Output tokens: ${response.usage.completion_tokens}`);
      console.log(`Total tokens: ${response.usage.total_tokens}`);
    }

    // Extract the generated content (flashcards)
    const flashcards = response.choices[0]?.message?.content || 'No flashcards generated.';

    // Log and send the generated flashcards
    console.log('Generated Flashcards:', flashcards);

    // Parse the generated flashcards string into an array of question-answer objects
    const parsedFlashcards = parseFlashcards(flashcards);

    // Log and return the parsed flashcards as a JSON response
    console.log('Parsed Flashcards:', parsedFlashcards);
    res.json({ flashcards: parsedFlashcards });

  } catch (error) {
    console.error('Error processing PDF or generating flashcards:', error.message);
    res.status(500).send('Error: ' + error.message);
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
