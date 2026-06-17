import xml.etree.ElementTree as ET
import time
from flask import Flask, render_template, jsonify, request
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def clean_html_content(content_html):
    """
    Parses the CDATA HTML content from the feed entry.
    Splits the entry into individual updates grouped by headers (e.g., Feature, Issue, Deprecation, Change).
    """
    if not content_html:
        return []
        
    soup = BeautifulSoup(content_html, 'html.parser')
    h3_tags = soup.find_all('h3')
    
    updates = []
    
    if h3_tags:
        for h3 in h3_tags:
            update_type = h3.get_text().strip()
            
            # Gather all following sibling elements until the next h3 tag
            sibling_content = []
            curr = h3.next_sibling
            while curr and curr.name != 'h3':
                if curr.name:  # Only add valid HTML elements
                    # Keep URLs absolute if they are relative
                    for link in curr.find_all('a', href=True):
                        if link['href'].startswith('/'):
                            link['href'] = 'https://docs.cloud.google.com' + link['href']
                    sibling_content.append(str(curr))
                else:
                    # Capture text node details
                    txt = str(curr).strip()
                    if txt:
                        sibling_content.append(txt)
                curr = curr.next_sibling
                
            update_html = "".join(sibling_content)
            
            # Create a plain text description for tweeting
            temp_soup = BeautifulSoup(update_html, 'html.parser')
            plain_text = temp_soup.get_text().strip()
            
            # Normalize whitespace
            plain_text = " ".join(plain_text.split())
            
            updates.append({
                "type": update_type,
                "html": update_html,
                "text": plain_text
            })
    else:
        # Fallback if no h3 headings exist
        # Make links absolute in fallback
        for link in soup.find_all('a', href=True):
            if link['href'].startswith('/'):
                link['href'] = 'https://docs.cloud.google.com' + link['href']
        
        plain_text = " ".join(soup.get_text().strip().split())
        updates.append({
            "type": "Update",
            "html": str(soup),
            "text": plain_text
        })
        
    return updates

def fetch_feed(force=False):
    """
    Fetches the BigQuery release notes Atom feed and parses it.
    Uses memory caching unless force=True is specified.
    """
    now = time.time()
    if not force and cache["data"] is not None and (now - cache["last_fetched"]) < CACHE_DURATION:
        return cache["data"], True  # True indicates loaded from cache
        
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse XML (Atom namespace is http://www.w3.org/2005/Atom)
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        feed_title = root.find('atom:title', ns)
        feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
        
        parsed_entries = []
        
        for entry_el in root.findall('atom:entry', ns):
            title = entry_el.find('atom:title', ns)
            title_text = title.text if title is not None else "Unknown Date"
            
            updated = entry_el.find('atom:updated', ns)
            updated_text = updated.text if updated is not None else ""
            
            # Find the alternate link
            link_el = entry_el.find("atom:link[@rel='alternate']", ns)
            if link_el is None:
                link_el = entry_el.find("atom:link", ns)
            link_href = link_el.attrib.get('href', '') if link_el is not None else ''
            
            # Extract content HTML
            content_el = entry_el.find('atom:content', ns)
            content_html = content_el.text if content_el is not None else ""
            
            updates = clean_html_content(content_html)
            
            parsed_entries.append({
                "date": title_text,
                "updated": updated_text,
                "link": link_href,
                "updates": updates
            })
            
        result = {
            "title": feed_title_text,
            "entries": parsed_entries,
            "fetched_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now))
        }
        
        # Save cache
        cache["data"] = result
        cache["last_fetched"] = now
        
        return result, False
        
    except Exception as e:
        # If fetch fails, return cache if available
        if cache["data"] is not None:
            return cache["data"], True
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, from_cache = fetch_feed(force=force)
        return jsonify({
            "success": True,
            "from_cache": from_cache,
            "data": data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
