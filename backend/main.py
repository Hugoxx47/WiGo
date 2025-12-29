from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Projet": "#6", "Status": "Ready for Biopsy Analysis"}