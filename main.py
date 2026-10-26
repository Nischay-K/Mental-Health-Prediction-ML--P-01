from pathlib import Path
import pandas as pd

import joblib
from fastapi import FastAPI
from pydantic import BaseModel , Field
from typing import Literal #For Custom Validation
from fastapi.middleware.cors import CORSMiddleware #CORS is used to connect Frontend and Backend -> Because frontend will
                                                    #be in one port(assume 5000) and backend in 2200 to connect both we should
                                                    #always use CORS Middleware!!!!
                                                    #CORS -> Cross Origin Resource Sharing
app = FastAPI()
MODEL_PATH = Path(__file__).resolve().parent / 'Mental_Health_Model.pkl'
model = joblib.load(MODEL_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_methods = ["*"],
    allow_headers = ["*"],
)

class StudentData(BaseModel):
    Age                     : int = Field(... , ge = 10 , le = 100)
    Gender                  : Literal['Male' , 'Female']
    Country                 : str
    Academic_Level          : Literal['Undergraduate', 'Graduate', 'High School']
    Most_Used_Platform      : Literal['Facebook','LinkedIn','Instagram','Snapchat','Twitter','YouTube','TikTok','LINE','KakaoTalk','VKontakte','WhatsApp','WeChat']
    Purpose_Of_Use          : Literal['Networking', 'Education', 'Entertainment', 'News']
    Avg_Daily_Usage_Hours   : float = Field(... , ge = 0 , le = 24)
    Daily_Unlocks           : int = Field(... , ge = 0)
    Study_Hours             : float = Field(... , ge = 0 , le = 24)
    Physical_Activity_Hours : float = Field(... , ge = 0 , le = 24)
    Sleep_Hours_Per_Night   : float = Field(... , ge = 0 , le = 24)
    Stress_Level            : Literal['Medium', 'Low', 'Very High', 'High']
    


#Response Body
class PredictedResponse(BaseModel):
    predicted_mental_health_score : float


@app.get('/')
def hello():
    return {'message': 'Welcomes You!!'}


top_countries = ['Other','India','USA','Canada','Australia','UK','Germany','Mexico','Turkey','France']

@app.post('/predict' , response_model = PredictedResponse)
def predict(data : StudentData):

    country_group = data.Country if data.Country in top_countries else "Other"

    input_rows = pd.DataFrame([{
        'Age'                     : data.Age,
        'Gender'                  : data.Gender,
        'Country'                 : data.Country,
        'Academic_Level'          : data.Academic_Level,
        'Most_Used_Platform'      : data.Most_Used_Platform,
        'Purpose_Of_Use'          : data.Purpose_Of_Use,
        'Avg_Daily_Usage_Hours'   : data.Avg_Daily_Usage_Hours,
        'Daily_Unlocks'           : data.Daily_Unlocks,
        'Study_Hours'             : data.Study_Hours,
        'Physical_Activity_Hours' : data.Physical_Activity_Hours,
        'Sleep_Hours_Per_Night'   : data.Sleep_Hours_Per_Night,
        'Stress_Level'            : data.Stress_Level,
        'grouped_Country'         : country_group
    
    }])

    prediction = model.predict(input_rows)[0]

    return PredictedResponse(predicted_mental_health_score = round(float(prediction),2))