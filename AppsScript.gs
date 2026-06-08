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
    var sheet = ss.getSheetByName("Automation");
    var sheetCredential = ss.getSheetByName("Credential");
    
    if (!sheet || !sheetCredential) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Nama sheet 'Automation' atau 'Credential' tidak ditemukan!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Inisialisasi baris kosong sepanjang 10 kolom (Kolom A sampai J) untuk sheet Automation
    var rowData = [];
    for (var i = 0; i < 10; i++) {
      rowData.push("");
    }
    
    // Inisialisasi baris kosong sepanjang 33 kolom (Kolom A sampai AG) untuk sheet Credential
    var rowDataCred = [];
    for (var i = 0; i < 33; i++) {
      rowDataCred.push("");
    }
    
    // 1. Pemetaan Data Statis (Owner, Outlet, Aplikasi, BD)
    rowData[0] = data.owner || "";         // Kolom A: Owner
    rowData[1] = data.outlet || "";        // Kolom B: Nama Outlet
    rowData[2] = data.aplikator || "";     // Kolom C: Aplikasi
    rowData[8] = data.bd || "";            // Kolom I: Nama BD
    
    rowDataCred[0] = data.owner || "";     // Kolom A: Owner
    rowDataCred[1] = data.outlet || "";    // Kolom B: Nama Outlet
    rowDataCred[3] = data.aplikator || ""; // Kolom D: Aplikasi
    rowDataCred[32] = data.bd || "";       // Kolom AG: Nama BD
    
    // 2. Pemetaan Data Kredensial sesuai jenis Aplikator
    var aplikatorLower = (data.aplikator || "").toLowerCase();
    
    if (aplikatorLower.indexOf("gofood") !== -1 || aplikatorLower === "go") {
      rowData[4] = data.emailDuck || "";          // Kolom E: Email Duck
      rowData[5] = data.emailFoodmaster || "";    // Kolom F: Email Foodmaster
      rowData[9] = data.namaAkses || "";          // Kolom J: Nama Akses
      
      rowDataCred[24] = data.emailDuck || "";       // Kolom Y: Email Duck
      rowDataCred[25] = data.emailFoodmaster || ""; // Kolom Z: Email Foodmaster
      rowDataCred[23] = data.namaAkses || "";       // Kolom X: Nama Akses

    } else if (aplikatorLower.indexOf("shopee") !== -1) {
      // Username & Password dikirim langsung dari frontend (sudah di-resolve dari CSV)
      rowData[3] = data.merchantName || "";    // Kolom D: Merchant Name
      rowData[6] = data.username || "";        // Kolom G: Username BD
      rowData[7] = data.password || "";        // Kolom H: Password BD
      
      rowDataCred[22] = data.merchantName || ""; // Kolom W: Merchant Name
      rowDataCred[26] = data.username || "";     // Kolom AA: Nama Pengguna
      rowDataCred[28] = data.password || "";     // Kolom AC: Kata Sandi

    } else if (aplikatorLower.indexOf("grab") !== -1 || aplikatorLower === "gr") {
      rowData[6] = data.username || "";        // Kolom G: Nama Pengguna
      rowData[7] = data.password || "";        // Kolom H: Kata Sandi
      
      rowDataCred[26] = data.username || "";     // Kolom AA: Nama Pengguna
      rowDataCred[28] = data.password || "";     // Kolom AC: Kata Sandi
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

    // Cari baris terakhir di sheet Credential
    var colBValuesCred = sheetCredential.getRange("B:B").getValues();
    var trueLastRowCred = 0;
    for (var r = colBValuesCred.length - 1; r >= 0; r--) {
      if (colBValuesCred[r][0] && colBValuesCred[r][0].toString().trim() !== "") {
        trueLastRowCred = r + 1;
        break;
      }
    }
    
    // Tulis data ke sheet Credential
    var insertRowCred = trueLastRowCred + 1;
    sheetCredential.getRange(insertRowCred, 1, 1, rowDataCred.length).setValues([rowDataCred]);
    
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
