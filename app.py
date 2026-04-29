from flask import Flask, render_template, request, jsonify
import yt_dlp
import requests
from litellm import completion
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

def get_captions(url):
    ydl_opts = {
        'writeautomaticsub': True,
        'skip_download': True,
        'subtitleslangs': ['en'],
        'quiet': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        # Get auto-generated captions
        if 'automatic_captions' in info and 'en' in info['automatic_captions']:
            captions = info['automatic_captions']['en']
            # Find vtt format
            for caption in captions:
                if caption['ext'] == 'vtt':
                    # Download caption content
                    response = requests.get(caption['url'])
                    return clean_vtt(response.text)

        # Fallback to manual captions
        if 'subtitles' in info and 'en' in info['subtitles']:
            captions = info['subtitles']['en']
            for caption in captions:
                if caption['ext'] == 'vtt':
                    response = requests.get(caption['url'])
                    return clean_vtt(response.text)

    return None

def clean_vtt(vtt_text):
    """Remove VTT formatting, keep just text"""
    lines = vtt_text.split('\n')
    text_lines = []
    for line in lines:
        line = line.strip()
        # Skip VTT headers, timestamps, empty lines
        if (not line.startswith('WEBVTT') and
            not line.startswith('Kind:') and
            not line.startswith('Language:') and
            not '-->' in line and
            not line.isdigit() and
            line):
            text_lines.append(line)
    return ' '.join(text_lines)

def summarize_text(text, model='claude-3-5-sonnet-20241022'):
    """Send to LLM for summary"""
    response = completion(
        model=model,
        messages=[{
            'role': 'user',
            'content': f'Summarize this YouTube video transcript in 3-5 bullet points:\n\n{text[:8000]}'  # truncate if huge
        }]
    )
    return response.choices[0].message.content

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize():
    url = request.form.get('url')

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # Extract captions
        captions = get_captions(url)
        if not captions:
            return jsonify({'error': 'No captions found'}), 404

        # Summarize
        summary = summarize_text(captions)

        return jsonify({
            'summary': summary,
            'caption_length': len(captions)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
