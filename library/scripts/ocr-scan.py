import sys
import base64
import PyPDF2
from google import genai
from google.genai import types

if len(sys.argv) < 3:
    print("Usage: python ocr-scan.py <input.pdf> <output.txt>")
    sys.exit(1)

input_pdf = sys.argv[1]
output_txt = sys.argv[2]
BATCH_SIZE = 5

client = genai.Client(vertexai=True, location='us-central1', project='flutter-ai-playground-f880c')
prompt = "You are an expert transcriber of historical manuscripts. Extract all text from this scanned document verbatim. Maintain original spelling and paragraph breaks. Do NOT translate or summarize. Output ONLY the raw transcribed text."

reader = PyPDF2.PdfReader(input_pdf)
total_pages = len(reader.pages)
print(f"Loaded {input_pdf} with {total_pages} pages.")

with open(output_txt, "w", encoding="utf-8") as out:
    for i in range(0, total_pages, BATCH_SIZE):
        end = min(i + BATCH_SIZE, total_pages)
        print(f"Processing pages {i+1} to {end}...")
        
        writer = PyPDF2.PdfWriter()
        for j in range(i, end):
            writer.add_page(reader.pages[j])
            
        temp_pdf = f"{input_pdf}.temp.pdf"
        with open(temp_pdf, "wb") as temp_out:
            writer.write(temp_out)
            
        with open(temp_pdf, "rb") as temp_in:
            pdf_bytes = temp_in.read()
            
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
                prompt
            ]
        )
        
        out.write(response.text)
        out.write("\n\n")
        out.flush()
        
        import os
        os.remove(temp_pdf)

print(f"Done processing {input_pdf}. Output saved to {output_txt}.")
