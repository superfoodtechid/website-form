/**
 * Google Apps Script - SuperFood Credentials Integration Backend
 * Spreadsheet URL: https://docs.google.com/spreadsheets/d/14eCb8DAEXhmbYj9MFj2KzC7AhkulbCbSNPltN2m-go0/edit?gid=0#gid=0
 * Target Sheet Name: "credential"
 *
 * MAPPING SPESIFIKASI:
 * Kolom A (Index 0)  -> Owner (Nama Owner)
 * Kolom B (Index 1)  -> Nama Outlet (Nama Outlet)
 * Kolom D (Index 3)  -> Aplikasi (Nama Aplikator: GoFood / Grab / Shopee)
 * Kolom W (Index 22) -> Merchant Name (jika Shopee)
 * Kolom Y (Index 24) -> Email (jika GoFood)
 * Kolom Z (Index 25) -> Nama Pengguna (jika Grab Username)
 * Kolom AB (Index 27)-> Kata Sandi (jika Grab Password)
 * Kolom AH (Index 33)-> Status (Selalu mengirim "Live")
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Gunakan lock service untuk mencegah tabrakan data jika diakses bersamaan
    lock.waitLock(10000); 
    
    // Parse JSON data dari payload POST
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    
    // Target Google Spreadsheet ID
    var sheetId = "14eCb8DAEXhmbYj9MFj2KzC7AhkulbCbSNPltN2m-go0";
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName("credential");
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Nama sheet 'credential' tidak ditemukan!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Inisialisasi baris kosong sepanjang 34 kolom (Kolom A sampai AH)
    var rowData = [];
    for (var i = 0; i < 34; i++) {
      rowData.push("");
    }
    
    // 1. Pemetaan Data Statis (Owner, Outlet, Aplikasi, Status)
    rowData[0] = data.owner || "";         // Kolom A: Owner
    rowData[1] = data.outlet || "";        // Kolom B: Nama Outlet
    rowData[3] = data.aplikator || "";     // Kolom D: Aplikasi
    rowData[33] = "Live";                  // Kolom AH: Status
    
    // 2. Pemetaan Data Kredensial sesuai jenis Aplikator
    var aplikatorLower = (data.aplikator || "").toLowerCase();
    
    if (aplikatorLower.indexOf("gofood") !== -1 || aplikatorLower === "go") {
      rowData[24] = data.email || "";      // Kolom Y: Email
    } else if (aplikatorLower.indexOf("shopee") !== -1) {
      rowData[22] = data.merchantName || ""; // Kolom W: Merchant Name
    } else if (aplikatorLower.indexOf("grab") !== -1 || aplikatorLower === "gr") {
      rowData[25] = data.username || "";   // Kolom Z: Nama Pengguna
      rowData[27] = data.password || "";   // Kolom AB: Kata Sandi
    }
    
    // 3. Sisipkan baris baru secara presisi (Mengabaikan format/formula kosong di kolom lain)
    // Cari baris terakhir yang benar-benar ada isinya di Kolom B (Nama Outlet)
    var colBValues = sheet.getRange("B:B").getValues();
    var trueLastRow = 0;
    for (var r = colBValues.length - 1; r >= 0; r--) {
      if (colBValues[r][0] && colBValues[r][0].toString().trim() !== "") {
        trueLastRow = r + 1;
        break;
      }
    }
    
    // Tulis data tepat 1 baris di bawah outlet terakhir
    var insertRow = trueLastRow + 1;
    sheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    
    // Kembalikan response sukses CORS-friendly
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Kredensial berhasil disinkronisasi ke Google Sheets!" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Kembalikan pesan error jika terjadi kegagalan
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
