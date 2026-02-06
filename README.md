# Google Drive Image Uploader Backend

This is a Node.js/Express backend that uploads images to Google Drive and makes them publicly accessible.

## Prerequisites

1.  Node.js installed.
2.  Google Cloud Console credentials (Client ID and Secret) configured in `.env`.

## Installation

1.  Navigate to the `server` directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Setup & Authentication (One-time)

Before valid uploads can happen, you need to authorize the server to access your Google Drive.

1.  Start the server:
    ```bash
    node index.js
    ```
2.  Open your browser and visit: `http://localhost:3000/auth`
3.  Log in with your Google Account and allow permissions.
4.  You will be redirected to a success page.
5.  **CRITICAL**: Check your **Terminal/Console**. The **Refresh Token** will be printed there.
6.  Copy that Refresh Token and paste it into your `server/.env` file:
    ```env
    GOOGLE_REFRESH_TOKEN=your_copied_token_here
    ```
7.  Restart the server.

## Usage

### Upload an Image

**Endpoint**: `POST http://localhost:3000/upload`
**Body**: `multipart/form-data` with key `image`

#### Example using cURL:
```bash
curl -X POST -F "image=@/path/to/your/image.jpg" http://localhost:3000/upload
```

#### Example Response:
```json
{
    "message": "File uploaded successfully",
    "fileId": "1a2b3c...",
    "fileName": "1700000000_image.jpg",
    "viewLink": "https://drive.google.com/file/d/1a2b3c.../view?usp=drivesdk",
    "downloadLink": "https://drive.google.com/uc?id=1a2b3c...&export=download",
    "displayUrl": "https://lh3.googleusercontent.com/d/1a2b3c..."
}
```

The `displayUrl` is suitable for using in `<img src="..." />` tags on your frontend.
