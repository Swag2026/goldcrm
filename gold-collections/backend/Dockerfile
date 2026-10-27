FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 TZ=Asia/Riyadh
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# 1 worker hi rakho: GERP token cache, sync lock aur login throttle process-memory mein hain
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
