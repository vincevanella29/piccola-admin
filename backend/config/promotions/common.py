# promotions/common.py
def is_action_allowed(day_list, current_day):
    if not day_list:
        return True
    return current_day in day_list

def is_location_allowed(locations, current_location):
    if not locations:
        return True
    return current_location in locations