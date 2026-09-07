import { NextRequest, NextResponse } from "next/server";

// Standard Indian State Codes for GSTIN prefix
const STATE_CODES: Record<string, { state: string; city: string; pin: string; sampleAddress: string }> = {
  "01": { state: "Jammu & Kashmir", city: "Srinagar", pin: "190001", sampleAddress: "12, Residency Road, Lal Chowk, Srinagar, Jammu & Kashmir" },
  "02": { state: "Himachal Pradesh", city: "Shimla", pin: "171001", sampleAddress: "Plot No. 45, Mall Road, Shimla, Himachal Pradesh" },
  "03": { state: "Punjab", city: "Ludhiana", pin: "141001", sampleAddress: "B-XX-342, Ferozepur Road, Ludhiana, Punjab" },
  "04": { state: "Chandigarh", city: "Chandigarh", pin: "160017", sampleAddress: "SCO 120-122, Sector 17-C, Chandigarh" },
  "05": { state: "Uttarakhand", city: "Dehradun", pin: "248001", sampleAddress: "Rajpur Road, Near Jakhan, Dehradun, Uttarakhand" },
  "06": { state: "Haryana", city: "Gurugram", pin: "122018", sampleAddress: "Sector 48, Sohna Road, Gurugram, Haryana" },
  "07": { state: "Delhi", city: "New Delhi", pin: "110001", sampleAddress: "Flat No. 402, Connaught Place, New Delhi, Delhi" },
  "08": { state: "Rajasthan", city: "Jaipur", pin: "302001", sampleAddress: "C-Scheme, Ashok Marg, Jaipur, Rajasthan" },
  "09": { state: "Uttar Pradesh", city: "Noida", pin: "201301", sampleAddress: "Sector 62, Commercial Block, Noida, Uttar Pradesh" },
  "10": { state: "Bihar", city: "Patna", pin: "800001", sampleAddress: "Fraser Road, Near Patna Junction, Patna, Bihar" },
  "11": { state: "Sikkim", city: "Gangtok", pin: "737101", sampleAddress: "MG Marg, Gangtok, Sikkim" },
  "12": { state: "Arunachal Pradesh", city: "Itanagar", pin: "791111", sampleAddress: "Sector C, Itanagar, Arunachal Pradesh" },
  "13": { state: "Nagaland", city: "Kohima", pin: "797001", sampleAddress: "Circular Road, Kohima, Nagaland" },
  "14": { state: "Manipur", city: "Imphal", pin: "795001", sampleAddress: "Khuman Lampak, Imphal, Manipur" },
  "15": { state: "Mizoram", city: "Aizawl", pin: "796001", sampleAddress: "Treasury Square, Aizawl, Mizoram" },
  "16": { state: "Tripura", city: "Agartala", pin: "799001", sampleAddress: "Hari Ganga Basak Road, Agartala, Tripura" },
  "17": { state: "Meghalaya", city: "Shillong", pin: "793001", sampleAddress: "Police Bazar, Shillong, Meghalaya" },
  "18": { state: "Assam", city: "Guwahati", pin: "781005", sampleAddress: "G.S. Road, Christian Basti, Guwahati, Assam" },
  "19": { state: "West Bengal", city: "Kolkata", pin: "700091", sampleAddress: "Block EP & GP, Sector V, Salt Lake, Kolkata, West Bengal" },
  "20": { state: "Jharkhand", city: "Ranchi", pin: "834001", sampleAddress: "Main Road, Near Albert Ekka Chowk, Ranchi, Jharkhand" },
  "21": { state: "Odisha", city: "Bhubaneswar", pin: "751001", sampleAddress: "Janpath, Ashok Nagar, Bhubaneswar, Odisha" },
  "22": { state: "Chhattisgarh", city: "Raipur", pin: "492001", sampleAddress: "GE Road, Near Tatibandh Chowk, Raipur, Chhattisgarh" },
  "23": { state: "Madhya Pradesh", city: "Bhopal", pin: "462001", sampleAddress: "MP Nagar Zone-II, Bhopal, Madhya Pradesh" },
  "24": { state: "Gujarat", city: "Ahmedabad", pin: "380009", sampleAddress: "Ashram Road, Near Income Tax Cross Road, Ahmedabad, Gujarat" },
  "26": { state: "Dadra and Nagar Haveli and Daman and Diu", city: "Silvassa", pin: "396230", sampleAddress: "Piparia Industrial Estate, Silvassa" },
  "27": { state: "Maharashtra", city: "Mumbai", pin: "400051", sampleAddress: "G-Block, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra" },
  "29": { state: "Karnataka", city: "Bengaluru", pin: "560001", sampleAddress: "100 Feet Road, Indiranagar, Bengaluru, Karnataka" },
  "30": { state: "Goa", city: "Panaji", pin: "403001", sampleAddress: "Patto Plaza, Panaji, Goa" },
  "31": { state: "Lakshadweep", city: "Kavaratti", pin: "682555", sampleAddress: "Main Road, Kavaratti, Lakshadweep" },
  "32": { state: "Kerala", city: "Kochi", pin: "682011", sampleAddress: "M.G. Road, Ernakulam, Kochi, Kerala" },
  "33": { state: "Tamil Nadu", city: "Chennai", pin: "600002", sampleAddress: "Mount Road, Anna Salai, Chennai, Tamil Nadu" },
  "34": { state: "Puducherry", city: "Puducherry", pin: "605001", sampleAddress: "Vyasa Street, Puducherry" },
  "35": { state: "Andaman & Nicobar Islands", city: "Port Blair", pin: "744101", sampleAddress: "Aberdeen Bazar, Port Blair" },
  "36": { state: "Telangana", city: "Hyderabad", pin: "500081", sampleAddress: "Hitec City, Madhapur, Hyderabad, Telangana" },
  "37": { state: "Andhra Pradesh", city: "Visakhapatnam", pin: "530003", sampleAddress: "Dwaraka Nagar, Visakhapatnam, Andhra Pradesh" },
  "38": { state: "Ladakh", city: "Leh", pin: "194101", sampleAddress: "Fort Road, Leh, Ladakh" }
};

// Standard GSTIN regex
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  try {
    const params = await context.params;
    const gstin = params?.gstin?.toUpperCase()?.trim();

    if (!gstin) {
      return NextResponse.json(
        { error: "GSTIN parameter is required" },
        { status: 400 }
      );
    }

    if (!GSTIN_REGEX.test(gstin)) {
      return NextResponse.json(
        { error: "Invalid GSTIN format. Must be a 15-character alphanumeric code." },
        { status: 400 }
      );
    }

    const sandboxApiKey = process.env.SANDBOX_API_KEY;
    const sandboxSecret = process.env.SANDBOX_SECRET;

    // IF API KEYS ARE NOT SET, FALLBACK TO HIGH-QUALITY MOCK DATA (GREAT FOR DEV/SANDBOX)
    const getMockData = async (gstinCode: string) => {
      const stateCode = gstinCode.substring(0, 2);
      const stateDetails = STATE_CODES[stateCode] || {
        state: "Unknown State",
        city: "Unknown City",
        pin: "400001",
        sampleAddress: "Industrial Area, Phase-I, India"
      };

      const sum = gstinCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const firstNames = ["Reliance", "Tata", "Adani", "Infosys", "Wipro", "HCL", "Mahindra", "Bajaj", "TVS", "Larsen & Toubro"];
      const lastNames = ["Industries", "Technologies", "Consultancy", "Motors", "Enterprises", "Retail", "Steel", "Power", "Holdings", "Group"];
      const suffixes = ["Ltd", "Pvt Ltd", "Corp", "LLP"];
      
      const firstName = firstNames[sum % firstNames.length];
      const lastName = lastNames[(sum * 3) % lastNames.length];
      const suffix = suffixes[(sum * 7) % suffixes.length];
      
      const legalName = `${firstName} ${lastName} ${suffix}`;

      await new Promise((resolve) => setTimeout(resolve, 800));

      return {
        success: true,
        mocked: true,
        gstin: gstinCode,
        legalName,
        tradeName: legalName.replace(" Ltd.", ""),
        status: "ACTIVE",
        address: stateDetails.sampleAddress,
        state: stateDetails.state,
        district: stateDetails.city,
        city: stateDetails.city,
        pinCode: stateDetails.pin,
        taxpayerType: "Regular",
        message: "Fetched successfully (Development Mock Mode)"
      };
    };

    // IF API KEYS ARE NOT SET, RETURN AN ERROR
    if (!sandboxApiKey || !sandboxSecret) {
      return NextResponse.json(
        { error: "Sandbox API credentials are not configured in the environment variables." },
        { status: 500 }
      );
    }

    // REAL THIRD-PARTY SECURE API INTEGRATION (SANDBOX.CO.IN)
    // 1. First authenticate with Sandbox to retrieve a fresh JWT access token
    const authResponse = await fetch("https://api.sandbox.co.in/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": sandboxApiKey,
        "x-api-secret": sandboxSecret,
        "x-api-version": "1.0.0"
      }
    });

    if (!authResponse.ok) {
      const authErr = await authResponse.text();
      console.error("Sandbox authentication failed:", authErr);
      return NextResponse.json(
        { error: "Sandbox authentication failed. Please verify API key and secret in your env." },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData?.data?.access_token;

    if (!accessToken) {
      console.error("No access token found in auth response:", authData);
      return NextResponse.json(
        { error: "Access token could not be retrieved from Sandbox." },
        { status: 500 }
      );
    }

    // 2. Fetch the GSTIN details using the POST endpoint for public GSTIN compliance search
    const response = await fetch("https://api.sandbox.co.in/gst/compliance/public/gstin/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": sandboxApiKey,
        "x-api-version": "1.0.0",
        "authorization": accessToken
      },
      body: JSON.stringify({ gstin })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sandbox API error response:", errText);
      return NextResponse.json(
        { error: `Sandbox API failed (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("Raw Sandbox API response result:", JSON.stringify(result, null, 2));

    // Support nested data structures: e.g., result.data.data (Sandbox style) or result.data or result
    let gstData = result.data || result;
    if (gstData && gstData.data && typeof gstData.data === "object") {
      gstData = gstData.data;
    }

    if (!gstData) {
      return NextResponse.json(
        { error: "Empty response received from GST database." },
        { status: 404 }
      );
    }

    // Map Sandbox API response fields to a consistent output structure
    // lgnm: Legal Name of Business
    // tradeNam: Trade Name
    // sts: Status of GSTIN (e.g. Active, Cancelled)
    // pradr: Principal Place of Business address object
    const legalName = gstData.lgnm || gstData.tradeNam || "Unknown Business";
    const tradeName = gstData.tradeNam || legalName;
    const status = gstData.sts || "UNKNOWN";
    
    // Format address from Sandbox structure
    const pradr = gstData.pradr;
    let formattedAddress = "";
    if (pradr && pradr.addr) {
      const a = pradr.addr;
      formattedAddress = [
        a.bnm, // Building name
        a.bno, // Building number
        a.flno, // Floor number
        a.st, // Street/Road
        a.loc, // Location/Locality
        a.dst, // District
        a.stcd, // State Code / State name
        a.pncd // Pin Code
      ]
        .filter(Boolean)
        .join(", ");
    } else if (pradr?.addr) {
      formattedAddress = typeof pradr.addr === "string" ? pradr.addr : "";
    } else {
      formattedAddress = gstData.lgnm ? "Registered Address" : "";
    }

    return NextResponse.json({
      success: true,
      mocked: false,
      gstin,
      legalName,
      tradeName,
      status,
      address: formattedAddress,
      state: pradr?.addr?.stcd || "",
      district: pradr?.addr?.dst || "",
      city: pradr?.addr?.loc || pradr?.addr?.dst || "",
      pinCode: pradr?.addr?.pncd || "",
      taxpayerType: gstData.dty || "Regular"
    });

  } catch (error: any) {
    console.error("GST verification endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred while verifying GSTIN." },
      { status: 500 }
    );
  }
}
