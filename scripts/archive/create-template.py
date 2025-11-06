#!/usr/bin/env python3
"""
Create a template via API
"""
import sys
import json
import boto3
import requests
from datetime import datetime

# Configuration
API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
USER_POOL_ID = "us-east-1_asu0YOrBD"
CLIENT_ID = "4lb3j8kqfvfgkvfeb4h4naani5"
REGION = "us-east-1"

def get_auth_token(email, password):
    """Get Cognito ID token"""
    client = boto3.client('cognito-idp', region_name=REGION)
    
    try:
        response = client.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password
            }
        )
        return response['AuthenticationResult']['IdToken']
    except Exception as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)

def create_template(token, html_content):
    """Create template via API"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'template_name': 'Professional Lead Magnet Template',
        'template_description': 'A beautiful, responsive template for lead magnets with gradient styling',
        'html_content': html_content,
        'is_published': True
    }
    
    response = requests.post(
        f'{API_URL}/admin/templates',
        headers=headers,
        json=payload
    )
    
    if response.status_code == 201:
        return response.json()
    else:
        print(f"Error creating template: {response.status_code}")
        print(response.text)
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 create-template.py <email> <password>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    # Read template HTML
    try:
        with open('templates/sample-template.html', 'r') as f:
            html_content = f.read()
    except FileNotFoundError:
        print("Error: templates/sample-template.html not found")
        sys.exit(1)
    
    print("Authenticating...")
    token = get_auth_token(email, password)
    
    print("Creating template...")
    template = create_template(token, html_content)
    
    print("\n✅ Template created successfully!")
    print(f"Template ID: {template['template_id']}")
    print(f"Template Version: {template['version']}")
    print(f"Template Name: {template['template_name']}")
    print(f"\nYou can now use this template in a workflow!")
    print(f"Template ID to use: {template['template_id']}")

if __name__ == '__main__':
    main()

