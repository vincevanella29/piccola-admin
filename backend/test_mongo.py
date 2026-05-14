from pymongo import MongoClient
import json
from bson import ObjectId

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return str(o)

client = MongoClient('mongodb://localhost:27017/')
db = client['piccola_italia']
order = db['orders'].find_one({"order_type": "delivery"}, sort=[("created_at", -1)])
if order:
    print(json.dumps(order, cls=JSONEncoder, indent=2))
else:
    print("No delivery orders found")
