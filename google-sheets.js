import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "google-credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export async function upsertRow(guildId, messageId, dataFields) {
  const client = await auth.getClient();
  const email = await auth.getCredentials();
  console.log("Service Account Email:", email.client_email);
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = "1GhhRSIc5Mre_6JL7sSUMRozMBCHjM537er5dtsfAq84";
  // const spreadsheetId = "1R0TTCT1N5_CUnY1E30BVBOuIaImqUt93Pz8U2Tb5oP8";
  const sheetName = "Live Results"; // adjust as needed
  const range = `${sheetName}!A1:Z`; // covers a broad range
  console.log("range = ", range);

  // Step 1: Get current sheet data
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  const headers = rows[0] || [];

  // Step 2: Check if row with guildId + messageId exists
  const idIndex = {
    guildId: headers.indexOf("Guild ID"),
    messageId: headers.indexOf("Message ID"),
  };
  console.log("idindex:", idIndex);

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row[idIndex.guildId] === guildId && row[idIndex.messageId] === messageId) {
      rowIndex = i;
      break;
    }
  }

  // Step 3: Merge new data into row format
  const updatedRow = [...headers];
  headers.forEach((header, i) => {
    if (header === "Guild ID") updatedRow[i] = guildId;
    else if (header === "Message ID") updatedRow[i] = messageId;
    else if (dataFields[header] !== undefined) updatedRow[i] = dataFields[header];
    else if (rowIndex !== -1 && rows[rowIndex] && rows[rowIndex][i] !== undefined) {
      // Preserve existing values if row already exists
      updatedRow[i] = rows[rowIndex][i];
    } else {
      updatedRow[i] = ""; // clear if not included and no existing value
    }
  });

  // Step 4: Update or append
  if (rowIndex !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedRow],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          headers.map((header) =>
            header === "Guild ID"
              ? guildId
              : header === "Message ID"
              ? messageId
              : dataFields[header] || ""
          ),
        ],
      },
    });
  }
}
