from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time
import csv

# Configure Selenium WebDriver
chrome_options = Options()
chrome_options.add_argument("--headless")  # Run headless
chrome_options.add_argument("--disable-gpu")
service = Service('/path/to/chromedriver')  # Update with the path to your chromedriver

# URL to scrape
url = "https://maps.clb.org.hk/?i18n_language=en_US&map=3&startDate=2024-12&endDate=2024-12&eventId=2024120511353422735"

# Initialize WebDriver
driver = webdriver.Chrome(service=service, options=chrome_options)
driver.get(url)

# Allow time for page to load fully
time.sleep(5)  # Adjust based on network speed

# Parse the page source with BeautifulSoup
soup = BeautifulSoup(driver.page_source, 'html.parser')

# Define output file
output_file = "case_history.csv"

# Extract data fields
def extract_case_details(soup):
    cases = []
    case_elements = soup.find_all('div', class_='case-item')  # Update based on actual page structure

    for case in case_elements:
        case_data = {
            "date": case.find('span', class_='case-date').text.strip() if case.find('span', class_='case-date') else "",
            "description": case.find('p', class_='case-description').text.strip() if case.find('p', class_='case-description') else "",
            "location": case.find('span', class_='case-location').text.strip() if case.find('span', class_='case-location') else "",
            "industry": case.find('span', class_='case-industry').text.strip() if case.find('span', class_='case-industry') else "",
            "sub_industry": case.find('span', class_='case-sub-industry').text.strip() if case.find('span', class_='case-sub-industry') else "",
            "action_type": case.find('span', class_='case-action-type').text.strip() if case.find('span', class_='case-action-type') else "",
            "worker_grievances": case.find('span', class_='case-grievances').text.strip() if case.find('span', class_='case-grievances') else "",
            "number_of_participants": case.find('span', class_='case-participants').text.strip() if case.find('span', class_='case-participants') else "",
            "result": case.find('span', class_='case-result').text.strip() if case.find('span', class_='case-result') else "",
            "related_enterprises": case.find('span', class_='case-related-enterprises').text.strip() if case.find('span', class_='case-related-enterprises') else "",
            "company_ownership": case.find('span', class_='case-ownership').text.strip() if case.find('span', class_='case-ownership') else "",
            "source": case.find('a', class_='case-source')['href'] if case.find('a', class_='case-source') else "",
            "image": case.find('img', class_='case-image')['src'] if case.find('img', class_='case-image') else ""
        }
        cases.append(case_data)
    return cases

# Extract cases
cases = extract_case_details(soup)

# Save to CSV
with open(output_file, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.DictWriter(file, fieldnames=[
        "date", "description", "location", "industry", "sub_industry", "action_type",
        "worker_grievances", "number_of_participants", "result", "related_enterprises",
        "company_ownership", "source", "image"
    ])
    writer.writeheader()
    writer.writerows(cases)

print(f"Data saved to {output_file}")

# Close WebDriver
driver.quit()
