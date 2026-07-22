import bcrypt
from datetime import datetime
from config import Config

db = Config.db

email = 'admin@hireflow.ai'
password = 'Admin@1234'
company_name = 'HireFlow AI'
full_name = 'Admin User'

hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

existing = db.companies.find_one({'email': email})
if existing:
    db.companies.update_one({'email': email}, {'$set': {'password': hashed, 'is_verified': True}})
    print('Updated existing account.')
else:
    db.companies.insert_one({
        'email': email,
        'password': hashed,
        'company_name': company_name,
        'full_name': full_name,
        'is_verified': True,
        'created_at': datetime.utcnow()
    })
    print('Created new account successfully.')

print('---')
print('Email:   ', email)
print('Password:', password)
