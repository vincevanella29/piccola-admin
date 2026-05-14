from utils.web3mongo import db
order = db.delivery_orders.find_one({"order_type": "delivery"})
if order:
    print(list(order.keys()))
    if 'dispatch_records' in order:
        print("dispatch_records:", len(order['dispatch_records']))
