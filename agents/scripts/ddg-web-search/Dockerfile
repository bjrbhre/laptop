# Use an official Python runtime as a parent image
FROM python:3.12-slim

WORKDIR /app

COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
ENV MCP_HOST=0.0.0.0

COPY ./api /app/api

CMD ["python", "api/run_api.py"]
