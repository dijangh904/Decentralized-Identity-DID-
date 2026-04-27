#!/usr/bin/env python3
"""
Script to create a GitHub PR using the GitHub API
"""

import json
import requests
import os
from datetime import datetime

def create_pr():
    # GitHub API configuration
    GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')  # Set this environment variable
    REPO_OWNER = "olaleyeolajide81-sketch"
    REPO_NAME = "Decentralized-Identity-DID-"
    
    # PR details
    title = "feat: Implement Comprehensive RBAC System with Fine-Grained Permissions #140"
    head = "feature/performance-monitoring-rbac-upgradeable-contracts"
    base = "main"
    
    # Read PR description
    with open('PR_RBC_IMPLEMENTATION.md', 'r') as f:
        body = f.read()
    
    # GitHub API endpoint
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/pulls"
    
    # Headers
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }
    
    # PR data
    data = {
        'title': title,
        'head': head,
        'base': base,
        'body': body,
        'draft': False
    }
    
    try:
        # Create PR
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 201:
            pr_data = response.json()
            print(f"✅ PR created successfully!")
            print(f"🔗 PR URL: {pr_data['html_url']}")
            print(f"📝 PR Number: #{pr_data['number']}")
            print(f"📊 Status: {pr_data['state']}")
            return pr_data
        else:
            print(f"❌ Failed to create PR: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating PR: {str(e)}")
        return None

if __name__ == "__main__":
    print("🚀 Creating GitHub Pull Request...")
    print("=" * 50)
    
    # Check for GitHub token
    if not os.getenv('GITHUB_TOKEN'):
        print("⚠️  GITHUB_TOKEN environment variable not set")
        print("Please set your GitHub token: export GITHUB_TOKEN=your_token")
        exit(1)
    
    result = create_pr()
    
    if result:
        print("\n🎉 PR creation completed!")
        print("\n📋 Next steps:")
        print("1. Review the PR at the provided URL")
        print("2. Wait for CI checks to complete")
        print("3. Request review from maintainers")
        print("4. Address any feedback")
        print("5. Merge after approval")
    else:
        print("\n❌ PR creation failed!")
        print("Please check the error messages above and try again.")
