const AIRPORTS = [
  {
    "icao": "KATL",
    "iata": "ATL",
    "name": "Hartsfield-Jackson Atlanta Intl",
    "state": "GA",
    "lat": 33.6407,
    "lon": -84.4277
  },
  {
    "icao": "KLAX",
    "iata": "LAX",
    "name": "Los Angeles Intl",
    "state": "CA",
    "lat": 33.9416,
    "lon": -118.4085
  },
  {
    "icao": "KORD",
    "iata": "ORD",
    "name": "Chicago O'Hare Intl",
    "state": "IL",
    "lat": 41.9742,
    "lon": -87.9073
  },
  {
    "icao": "KDFW",
    "iata": "DFW",
    "name": "Dallas/Fort Worth Intl",
    "state": "TX",
    "lat": 32.8998,
    "lon": -97.0403
  },
  {
    "icao": "KDEN",
    "iata": "DEN",
    "name": "Denver Intl",
    "state": "CO",
    "lat": 39.8561,
    "lon": -104.6737
  },
  {
    "icao": "KJFK",
    "iata": "JFK",
    "name": "John F. Kennedy Intl",
    "state": "NY",
    "lat": 40.6413,
    "lon": -73.7781
  },
  {
    "icao": "KSFO",
    "iata": "SFO",
    "name": "San Francisco Intl",
    "state": "CA",
    "lat": 37.6213,
    "lon": -122.379
  },
  {
    "icao": "KSEA",
    "iata": "SEA",
    "name": "Seattle-Tacoma Intl",
    "state": "WA",
    "lat": 47.4502,
    "lon": -122.3088
  },
  {
    "icao": "KMIA",
    "iata": "MIA",
    "name": "Miami Intl",
    "state": "FL",
    "lat": 25.7959,
    "lon": -80.2871
  },
  {
    "icao": "KLAS",
    "iata": "LAS",
    "name": "Harry Reid Intl",
    "state": "NV",
    "lat": 36.084,
    "lon": -115.1537
  },
  {
    "icao": "KPHX",
    "iata": "PHX",
    "name": "Phoenix Sky Harbor Intl",
    "state": "AZ",
    "lat": 33.4342,
    "lon": -112.0116
  },
  {
    "icao": "KEWR",
    "iata": "EWR",
    "name": "Newark Liberty Intl",
    "state": "NJ",
    "lat": 40.6895,
    "lon": -74.1745
  },
  {
    "icao": "KIAH",
    "iata": "IAH",
    "name": "George Bush Intercontinental",
    "state": "TX",
    "lat": 29.9902,
    "lon": -95.3368
  },
  {
    "icao": "KBOS",
    "iata": "BOS",
    "name": "Boston Logan Intl",
    "state": "MA",
    "lat": 42.3656,
    "lon": -71.0096
  },
  {
    "icao": "KMSP",
    "iata": "MSP",
    "name": "Minneapolis-Saint Paul Intl",
    "state": "MN",
    "lat": 44.8848,
    "lon": -93.2223
  },
  {
    "icao": "KDTW",
    "iata": "DTW",
    "name": "Detroit Metropolitan Wayne County",
    "state": "MI",
    "lat": 42.2162,
    "lon": -83.3554
  },
  {
    "icao": "KPHL",
    "iata": "PHL",
    "name": "Philadelphia Intl",
    "state": "PA",
    "lat": 39.8744,
    "lon": -75.2424
  },
  {
    "icao": "KLGA",
    "iata": "LGA",
    "name": "LaGuardia",
    "state": "NY",
    "lat": 40.7769,
    "lon": -73.874
  },
  {
    "icao": "KBWI",
    "iata": "BWI",
    "name": "Baltimore/Washington Intl",
    "state": "MD",
    "lat": 39.1774,
    "lon": -76.6684
  },
  {
    "icao": "KDCA",
    "iata": "DCA",
    "name": "Ronald Reagan Washington National",
    "state": "VA",
    "lat": 38.8512,
    "lon": -77.0402
  },
  {
    "icao": "KIAD",
    "iata": "IAD",
    "name": "Washington Dulles Intl",
    "state": "VA",
    "lat": 38.9531,
    "lon": -77.4565
  },
  {
    "icao": "KSLC",
    "iata": "SLC",
    "name": "Salt Lake City Intl",
    "state": "UT",
    "lat": 40.7899,
    "lon": -111.9791
  },
  {
    "icao": "KSAN",
    "iata": "SAN",
    "name": "San Diego Intl",
    "state": "CA",
    "lat": 32.7338,
    "lon": -117.1933
  },
  {
    "icao": "KCLT",
    "iata": "CLT",
    "name": "Charlotte Douglas Intl",
    "state": "NC",
    "lat": 35.214,
    "lon": -80.9431
  },
  {
    "icao": "KTPA",
    "iata": "TPA",
    "name": "Tampa Intl",
    "state": "FL",
    "lat": 27.9755,
    "lon": -82.5332
  },
  {
    "icao": "KPDX",
    "iata": "PDX",
    "name": "Portland Intl",
    "state": "OR",
    "lat": 45.5898,
    "lon": -122.5951
  },
  {
    "icao": "KHNL",
    "iata": "HNL",
    "name": "Daniel K. Inouye Intl",
    "state": "HI",
    "lat": 21.3187,
    "lon": -157.9224
  },
  {
    "icao": "KSTL",
    "iata": "STL",
    "name": "St. Louis Lambert Intl",
    "state": "MO",
    "lat": 38.7487,
    "lon": -90.37
  },
  {
    "icao": "KCLE",
    "iata": "CLE",
    "name": "Cleveland Hopkins Intl",
    "state": "OH",
    "lat": 41.4117,
    "lon": -81.8498
  },
  {
    "icao": "KCMH",
    "iata": "CMH",
    "name": "John Glenn Columbus Intl",
    "state": "OH",
    "lat": 39.998,
    "lon": -82.8919
  },
  {
    "icao": "KCVG",
    "iata": "CVG",
    "name": "Cincinnati/Northern Kentucky Intl",
    "state": "KY",
    "lat": 39.0488,
    "lon": -84.6678
  },
  {
    "icao": "KMCO",
    "iata": "MCO",
    "name": "Orlando Intl",
    "state": "FL",
    "lat": 28.4312,
    "lon": -81.3081
  },
  {
    "icao": "KFLL",
    "iata": "FLL",
    "name": "Fort Lauderdale-Hollywood Intl",
    "state": "FL",
    "lat": 26.0726,
    "lon": -80.1527
  },
  {
    "icao": "KPBI",
    "iata": "PBI",
    "name": "Palm Beach Intl",
    "state": "FL",
    "lat": 26.6832,
    "lon": -80.0956
  },
  {
    "icao": "KJAX",
    "iata": "JAX",
    "name": "Jacksonville Intl",
    "state": "FL",
    "lat": 30.4941,
    "lon": -81.6879
  },
  {
    "icao": "KRSW",
    "iata": "RSW",
    "name": "Southwest Florida Intl",
    "state": "FL",
    "lat": 26.5362,
    "lon": -81.7552
  },
  {
    "icao": "KRDU",
    "iata": "RDU",
    "name": "Raleigh-Durham Intl",
    "state": "NC",
    "lat": 35.8801,
    "lon": -78.788
  },
  {
    "icao": "KBNA",
    "iata": "BNA",
    "name": "Nashville Intl",
    "state": "TN",
    "lat": 36.1245,
    "lon": -86.6782
  },
  {
    "icao": "KMEM",
    "iata": "MEM",
    "name": "Memphis Intl",
    "state": "TN",
    "lat": 35.0425,
    "lon": -89.9767
  },
  {
    "icao": "KMSY",
    "iata": "MSY",
    "name": "Louis Armstrong New Orleans Intl",
    "state": "LA",
    "lat": 29.9934,
    "lon": -90.258
  },
  {
    "icao": "KAUS",
    "iata": "AUS",
    "name": "Austin-Bergstrom Intl",
    "state": "TX",
    "lat": 30.1975,
    "lon": -97.6664
  },
  {
    "icao": "KSAT",
    "iata": "SAT",
    "name": "San Antonio Intl",
    "state": "TX",
    "lat": 29.5337,
    "lon": -98.4698
  },
  {
    "icao": "KHOU",
    "iata": "HOU",
    "name": "William P. Hobby",
    "state": "TX",
    "lat": 29.6454,
    "lon": -95.2789
  },
  {
    "icao": "KDAL",
    "iata": "DAL",
    "name": "Dallas Love Field",
    "state": "TX",
    "lat": 32.8471,
    "lon": -96.8518
  },
  {
    "icao": "KELP",
    "iata": "ELP",
    "name": "El Paso Intl",
    "state": "TX",
    "lat": 31.8072,
    "lon": -106.3776
  },
  {
    "icao": "KABQ",
    "iata": "ABQ",
    "name": "Albuquerque Intl Sunport",
    "state": "NM",
    "lat": 35.0402,
    "lon": -106.609
  },
  {
    "icao": "KTUS",
    "iata": "TUS",
    "name": "Tucson Intl",
    "state": "AZ",
    "lat": 32.1161,
    "lon": -110.941
  },
  {
    "icao": "KBOI",
    "iata": "BOI",
    "name": "Boise Air Terminal",
    "state": "ID",
    "lat": 43.5644,
    "lon": -116.2228
  },
  {
    "icao": "KSJC",
    "iata": "SJC",
    "name": "San Jose Mineta Intl",
    "state": "CA",
    "lat": 37.3639,
    "lon": -121.9289
  },
  {
    "icao": "KOAK",
    "iata": "OAK",
    "name": "Oakland Intl",
    "state": "CA",
    "lat": 37.7126,
    "lon": -122.2197
  },
  {
    "icao": "KSNA",
    "iata": "SNA",
    "name": "John Wayne",
    "state": "CA",
    "lat": 33.6757,
    "lon": -117.8678
  },
  {
    "icao": "KLGB",
    "iata": "LGB",
    "name": "Long Beach",
    "state": "CA",
    "lat": 33.8177,
    "lon": -118.1516
  },
  {
    "icao": "KBUR",
    "iata": "BUR",
    "name": "Hollywood Burbank",
    "state": "CA",
    "lat": 34.2007,
    "lon": -118.359
  },
  {
    "icao": "KONT",
    "iata": "ONT",
    "name": "Ontario Intl",
    "state": "CA",
    "lat": 34.056,
    "lon": -117.6012
  },
  {
    "icao": "KSMF",
    "iata": "SMF",
    "name": "Sacramento Intl",
    "state": "CA",
    "lat": 38.6954,
    "lon": -121.5908
  },
  {
    "icao": "KFAT",
    "iata": "FAT",
    "name": "Fresno Yosemite Intl",
    "state": "CA",
    "lat": 36.7762,
    "lon": -119.7181
  },
  {
    "icao": "KPSP",
    "iata": "PSP",
    "name": "Palm Springs Intl",
    "state": "CA",
    "lat": 33.8297,
    "lon": -116.507
  },
  {
    "icao": "KSBP",
    "iata": "SBP",
    "name": "San Luis Obispo County",
    "state": "CA",
    "lat": 35.2371,
    "lon": -120.6424
  },
  {
    "icao": "KMRY",
    "iata": "MRY",
    "name": "Monterey Regional",
    "state": "CA",
    "lat": 36.587,
    "lon": -121.843
  },
  {
    "icao": "KRNO",
    "iata": "RNO",
    "name": "Reno-Tahoe Intl",
    "state": "NV",
    "lat": 39.4991,
    "lon": -119.7681
  },
  {
    "icao": "KGEG",
    "iata": "GEG",
    "name": "Spokane Intl",
    "state": "WA",
    "lat": 47.6199,
    "lon": -117.5338
  },
  {
    "icao": "KPAE",
    "iata": "PAE",
    "name": "Paine Field",
    "state": "WA",
    "lat": 47.9063,
    "lon": -122.281
  },
  {
    "icao": "KBLI",
    "iata": "BLI",
    "name": "Bellingham Intl",
    "state": "WA",
    "lat": 48.7927,
    "lon": -122.5375
  },
  {
    "icao": "KPWM",
    "iata": "PWM",
    "name": "Portland Intl Jetport",
    "state": "ME",
    "lat": 43.6462,
    "lon": -70.3093
  },
  {
    "icao": "KBTV",
    "iata": "BTV",
    "name": "Burlington Intl",
    "state": "VT",
    "lat": 44.4719,
    "lon": -73.1533
  },
  {
    "icao": "KALB",
    "iata": "ALB",
    "name": "Albany Intl",
    "state": "NY",
    "lat": 42.7483,
    "lon": -73.8017
  },
  {
    "icao": "KSYR",
    "iata": "SYR",
    "name": "Syracuse Hancock Intl",
    "state": "NY",
    "lat": 43.1112,
    "lon": -76.1063
  },
  {
    "icao": "KROC",
    "iata": "ROC",
    "name": "Greater Rochester Intl",
    "state": "NY",
    "lat": 43.1189,
    "lon": -77.6724
  },
  {
    "icao": "KBUF",
    "iata": "BUF",
    "name": "Buffalo Niagara Intl",
    "state": "NY",
    "lat": 42.9405,
    "lon": -78.7322
  },
  {
    "icao": "KHPN",
    "iata": "HPN",
    "name": "Westchester County",
    "state": "NY",
    "lat": 41.067,
    "lon": -73.7076
  },
  {
    "icao": "KISP",
    "iata": "ISP",
    "name": "Long Island MacArthur",
    "state": "NY",
    "lat": 40.7952,
    "lon": -73.1002
  },
  {
    "icao": "KMDW",
    "iata": "MDW",
    "name": "Chicago Midway Intl",
    "state": "IL",
    "lat": 41.7868,
    "lon": -87.7522
  },
  {
    "icao": "KMKE",
    "iata": "MKE",
    "name": "Milwaukee Mitchell Intl",
    "state": "WI",
    "lat": 42.9472,
    "lon": -87.8966
  },
  {
    "icao": "KMSN",
    "iata": "MSN",
    "name": "Dane County Regional",
    "state": "WI",
    "lat": 43.1399,
    "lon": -89.3375
  },
  {
    "icao": "KGRR",
    "iata": "GRR",
    "name": "Gerald R. Ford Intl",
    "state": "MI",
    "lat": 42.8808,
    "lon": -85.5228
  },
  {
    "icao": "KFNT",
    "iata": "FNT",
    "name": "Bishop Intl",
    "state": "MI",
    "lat": 42.9654,
    "lon": -83.7436
  },
  {
    "icao": "KLAN",
    "iata": "LAN",
    "name": "Capital Region Intl",
    "state": "MI",
    "lat": 42.7787,
    "lon": -84.5874
  },
  {
    "icao": "KTVC",
    "iata": "TVC",
    "name": "Cherry Capital",
    "state": "MI",
    "lat": 44.7414,
    "lon": -85.5822
  },
  {
    "icao": "KIND",
    "iata": "IND",
    "name": "Indianapolis Intl",
    "state": "IN",
    "lat": 39.7173,
    "lon": -86.2944
  },
  {
    "icao": "KSDF",
    "iata": "SDF",
    "name": "Louisville Muhammad Ali Intl",
    "state": "KY",
    "lat": 38.1744,
    "lon": -85.736
  },
  {
    "icao": "KLEX",
    "iata": "LEX",
    "name": "Blue Grass",
    "state": "KY",
    "lat": 38.0365,
    "lon": -84.6059
  },
  {
    "icao": "KDAY",
    "iata": "DAY",
    "name": "James M. Cox Dayton Intl",
    "state": "OH",
    "lat": 39.9024,
    "lon": -84.2194
  },
  {
    "icao": "KCAK",
    "iata": "CAK",
    "name": "Akron-Canton",
    "state": "OH",
    "lat": 40.9161,
    "lon": -81.4422
  },
  {
    "icao": "KPIT",
    "iata": "PIT",
    "name": "Pittsburgh Intl",
    "state": "PA",
    "lat": 40.4915,
    "lon": -80.2329
  },
  {
    "icao": "KABE",
    "iata": "ABE",
    "name": "Lehigh Valley Intl",
    "state": "PA",
    "lat": 40.6521,
    "lon": -75.4408
  },
  {
    "icao": "KMDT",
    "iata": "MDT",
    "name": "Harrisburg Intl",
    "state": "PA",
    "lat": 40.1935,
    "lon": -76.7634
  },
  {
    "icao": "KAVP",
    "iata": "AVP",
    "name": "Wilkes-Barre/Scranton Intl",
    "state": "PA",
    "lat": 41.3385,
    "lon": -75.7234
  },
  {
    "icao": "KRIC",
    "iata": "RIC",
    "name": "Richmond Intl",
    "state": "VA",
    "lat": 37.5052,
    "lon": -77.3197
  },
  {
    "icao": "KORF",
    "iata": "ORF",
    "name": "Norfolk Intl",
    "state": "VA",
    "lat": 36.8946,
    "lon": -76.2012
  },
  {
    "icao": "KROA",
    "iata": "ROA",
    "name": "Roanoke-Blacksburg Regional",
    "state": "VA",
    "lat": 37.3255,
    "lon": -79.9754
  },
  {
    "icao": "KCHS",
    "iata": "CHS",
    "name": "Charleston Intl",
    "state": "SC",
    "lat": 32.8986,
    "lon": -80.0405
  },
  {
    "icao": "KGSP",
    "iata": "GSP",
    "name": "Greenville-Spartanburg Intl",
    "state": "SC",
    "lat": 34.8957,
    "lon": -82.2189
  },
  {
    "icao": "KCAE",
    "iata": "CAE",
    "name": "Columbia Metropolitan",
    "state": "SC",
    "lat": 33.9388,
    "lon": -81.1195
  },
  {
    "icao": "KSAV",
    "iata": "SAV",
    "name": "Savannah/Hilton Head Intl",
    "state": "GA",
    "lat": 32.1276,
    "lon": -81.2021
  },
  {
    "icao": "KAGS",
    "iata": "AGS",
    "name": "Augusta Regional",
    "state": "GA",
    "lat": 33.3699,
    "lon": -81.9645
  },
  {
    "icao": "KBHM",
    "iata": "BHM",
    "name": "Birmingham-Shuttlesworth Intl",
    "state": "AL",
    "lat": 33.5629,
    "lon": -86.7535
  },
  {
    "icao": "KMOB",
    "iata": "MOB",
    "name": "Mobile Regional",
    "state": "AL",
    "lat": 30.6914,
    "lon": -88.2428
  },
  {
    "icao": "KHSV",
    "iata": "HSV",
    "name": "Huntsville Intl",
    "state": "AL",
    "lat": 34.6404,
    "lon": -86.7731
  },
  {
    "icao": "KJAN",
    "iata": "JAN",
    "name": "Jackson-Medgar Wiley Evers Intl",
    "state": "MS",
    "lat": 32.3112,
    "lon": -90.0759
  },
  {
    "icao": "KGPT",
    "iata": "GPT",
    "name": "Gulfport-Biloxi Intl",
    "state": "MS",
    "lat": 30.4073,
    "lon": -89.0701
  },
  {
    "icao": "KTLH",
    "iata": "TLH",
    "name": "Tallahassee Intl",
    "state": "FL",
    "lat": 30.3965,
    "lon": -84.3503
  },
  {
    "icao": "KPNS",
    "iata": "PNS",
    "name": "Pensacola Intl",
    "state": "FL",
    "lat": 30.4734,
    "lon": -87.1866
  },
  {
    "icao": "KECP",
    "iata": "ECP",
    "name": "Northwest Florida Beaches Intl",
    "state": "FL",
    "lat": 30.3571,
    "lon": -85.7954
  },
  {
    "icao": "KSRQ",
    "iata": "SRQ",
    "name": "Sarasota Bradenton Intl",
    "state": "FL",
    "lat": 27.3946,
    "lon": -82.5544
  },
  {
    "icao": "KPIE",
    "iata": "PIE",
    "name": "St. Pete-Clearwater Intl",
    "state": "FL",
    "lat": 27.9102,
    "lon": -82.6874
  },
  {
    "icao": "KAVL",
    "iata": "AVL",
    "name": "Asheville Regional",
    "state": "NC",
    "lat": 35.4362,
    "lon": -82.5418
  },
  {
    "icao": "KFAY",
    "iata": "FAY",
    "name": "Fayetteville Regional",
    "state": "NC",
    "lat": 34.9912,
    "lon": -78.8803
  },
  {
    "icao": "KILM",
    "iata": "ILM",
    "name": "Wilmington Intl",
    "state": "NC",
    "lat": 34.2706,
    "lon": -77.9026
  },
  {
    "icao": "KMYR",
    "iata": "MYR",
    "name": "Myrtle Beach Intl",
    "state": "SC",
    "lat": 33.6798,
    "lon": -78.9283
  },
  {
    "icao": "KTYS",
    "iata": "TYS",
    "name": "McGhee Tyson",
    "state": "TN",
    "lat": 35.811,
    "lon": -83.994
  },
  {
    "icao": "KCHA",
    "iata": "CHA",
    "name": "Chattanooga Metropolitan",
    "state": "TN",
    "lat": 35.0353,
    "lon": -85.2038
  },
  {
    "icao": "KTUL",
    "iata": "TUL",
    "name": "Tulsa Intl",
    "state": "OK",
    "lat": 36.1984,
    "lon": -95.8881
  },
  {
    "icao": "KOKC",
    "iata": "OKC",
    "name": "Will Rogers World",
    "state": "OK",
    "lat": 35.3931,
    "lon": -97.6007
  },
  {
    "icao": "KXNA",
    "iata": "XNA",
    "name": "Northwest Arkansas National",
    "state": "AR",
    "lat": 36.2819,
    "lon": -94.3068
  },
  {
    "icao": "KLIT",
    "iata": "LIT",
    "name": "Bill and Hillary Clinton National",
    "state": "AR",
    "lat": 34.7294,
    "lon": -92.2243
  },
  {
    "icao": "KDSM",
    "iata": "DSM",
    "name": "Des Moines Intl",
    "state": "IA",
    "lat": 41.534,
    "lon": -93.6631
  },
  {
    "icao": "KCID",
    "iata": "CID",
    "name": "The Eastern Iowa",
    "state": "IA",
    "lat": 41.8847,
    "lon": -91.7108
  },
  {
    "icao": "KOMA",
    "iata": "OMA",
    "name": "Eppley Airfield",
    "state": "NE",
    "lat": 41.3032,
    "lon": -95.8941
  },
  {
    "icao": "KLNK",
    "iata": "LNK",
    "name": "Lincoln",
    "state": "NE",
    "lat": 40.851,
    "lon": -96.7592
  },
  {
    "icao": "KFSD",
    "iata": "FSD",
    "name": "Sioux Falls Regional",
    "state": "SD",
    "lat": 43.5814,
    "lon": -96.7419
  },
  {
    "icao": "KRAP",
    "iata": "RAP",
    "name": "Rapid City Regional",
    "state": "SD",
    "lat": 44.0453,
    "lon": -103.0574
  },
  {
    "icao": "KBIS",
    "iata": "BIS",
    "name": "Bismarck Municipal",
    "state": "ND",
    "lat": 46.7727,
    "lon": -100.7467
  },
  {
    "icao": "KFAR",
    "iata": "FAR",
    "name": "Hector Intl",
    "state": "ND",
    "lat": 46.9207,
    "lon": -96.8158
  },
  {
    "icao": "KGFK",
    "iata": "GFK",
    "name": "Grand Forks Intl",
    "state": "ND",
    "lat": 47.9493,
    "lon": -97.1761
  },
  {
    "icao": "KMSO",
    "iata": "MSO",
    "name": "Missoula Montana",
    "state": "MT",
    "lat": 46.9163,
    "lon": -114.0906
  },
  {
    "icao": "KBZN",
    "iata": "BZN",
    "name": "Bozeman Yellowstone Intl",
    "state": "MT",
    "lat": 45.7775,
    "lon": -111.1601
  },
  {
    "icao": "KHLN",
    "iata": "HLN",
    "name": "Helena Regional",
    "state": "MT",
    "lat": 46.6068,
    "lon": -111.9828
  },
  {
    "icao": "KBIL",
    "iata": "BIL",
    "name": "Billings Logan Intl",
    "state": "MT",
    "lat": 45.8077,
    "lon": -108.5429
  },
  {
    "icao": "KGTF",
    "iata": "GTF",
    "name": "Great Falls Intl",
    "state": "MT",
    "lat": 47.482,
    "lon": -111.3707
  },
  {
    "icao": "KIDA",
    "iata": "IDA",
    "name": "Idaho Falls Regional",
    "state": "ID",
    "lat": 43.5146,
    "lon": -112.0708
  },
  {
    "icao": "KPIH",
    "iata": "PIH",
    "name": "Pocatello Regional",
    "state": "ID",
    "lat": 42.9098,
    "lon": -112.5965
  },
  {
    "icao": "KTWF",
    "iata": "TWF",
    "name": "Magic Valley Regional",
    "state": "ID",
    "lat": 42.4818,
    "lon": -114.4877
  },
  {
    "icao": "KJAC",
    "iata": "JAC",
    "name": "Jackson Hole",
    "state": "WY",
    "lat": 43.6073,
    "lon": -110.7377
  },
  {
    "icao": "KCOD",
    "iata": "COD",
    "name": "Yellowstone Regional",
    "state": "WY",
    "lat": 44.5202,
    "lon": -109.0238
  },
  {
    "icao": "KCPR",
    "iata": "CPR",
    "name": "Casper/Natrona County Intl",
    "state": "WY",
    "lat": 42.908,
    "lon": -106.4645
  },
  {
    "icao": "KCYS",
    "iata": "CYS",
    "name": "Cheyenne Regional",
    "state": "WY",
    "lat": 41.1557,
    "lon": -104.8118
  },
  {
    "icao": "KGJT",
    "iata": "GJT",
    "name": "Grand Junction Regional",
    "state": "CO",
    "lat": 39.1224,
    "lon": -108.5267
  },
  {
    "icao": "KCOS",
    "iata": "COS",
    "name": "Colorado Springs",
    "state": "CO",
    "lat": 38.8058,
    "lon": -104.7009
  },
  {
    "icao": "KEGE",
    "iata": "EGE",
    "name": "Eagle County Regional",
    "state": "CO",
    "lat": 39.6426,
    "lon": -106.9177
  },
  {
    "icao": "KASE",
    "iata": "ASE",
    "name": "Aspen/Pitkin County",
    "state": "CO",
    "lat": 39.2232,
    "lon": -106.8688
  },
  {
    "icao": "KTEX",
    "iata": "TEX",
    "name": "Telluride Regional",
    "state": "CO",
    "lat": 37.9538,
    "lon": -107.9085
  },
  {
    "icao": "KFLG",
    "iata": "FLG",
    "name": "Flagstaff Pulliam",
    "state": "AZ",
    "lat": 35.1385,
    "lon": -111.6712
  },
  {
    "icao": "KPRC",
    "iata": "PRC",
    "name": "Prescott Regional",
    "state": "AZ",
    "lat": 34.6545,
    "lon": -112.4196
  },
  {
    "icao": "KGCN",
    "iata": "GCN",
    "name": "Grand Canyon National Park",
    "state": "AZ",
    "lat": 35.9524,
    "lon": -112.1469
  },
  {
    "icao": "KSAF",
    "iata": "SAF",
    "name": "Santa Fe Regional",
    "state": "NM",
    "lat": 35.6171,
    "lon": -106.0894
  },
  {
    "icao": "KROW",
    "iata": "ROW",
    "name": "Roswell Air Center",
    "state": "NM",
    "lat": 33.3016,
    "lon": -104.5305
  },
  {
    "icao": "KLRD",
    "iata": "LRD",
    "name": "Laredo Intl",
    "state": "TX",
    "lat": 27.5438,
    "lon": -99.4616
  },
  {
    "icao": "KMAF",
    "iata": "MAF",
    "name": "Midland Intl Air and Space Port",
    "state": "TX",
    "lat": 31.9425,
    "lon": -102.2019
  },
  {
    "icao": "KLBB",
    "iata": "LBB",
    "name": "Lubbock Preston Smith Intl",
    "state": "TX",
    "lat": 33.6636,
    "lon": -101.8228
  },
  {
    "icao": "KAMA",
    "iata": "AMA",
    "name": "Rick Husband Amarillo Intl",
    "state": "TX",
    "lat": 35.2194,
    "lon": -101.7059
  },
  {
    "icao": "KCRP",
    "iata": "CRP",
    "name": "Corpus Christi Intl",
    "state": "TX",
    "lat": 27.7704,
    "lon": -97.5012
  },
  {
    "icao": "KMFE",
    "iata": "MFE",
    "name": "McAllen Intl",
    "state": "TX",
    "lat": 26.1761,
    "lon": -98.2386
  },
  {
    "icao": "KBRO",
    "iata": "BRO",
    "name": "Brownsville South Padre Island Intl",
    "state": "TX",
    "lat": 25.9068,
    "lon": -97.4259
  },
  {
    "icao": "KSHV",
    "iata": "SHV",
    "name": "Shreveport Regional",
    "state": "LA",
    "lat": 32.4466,
    "lon": -93.8256
  },
  {
    "icao": "KLCH",
    "iata": "LCH",
    "name": "Lake Charles Regional",
    "state": "LA",
    "lat": 30.1261,
    "lon": -93.2234
  },
  {
    "icao": "KBTR",
    "iata": "BTR",
    "name": "Baton Rouge Metropolitan",
    "state": "LA",
    "lat": 30.5332,
    "lon": -91.1496
  },
  {
    "icao": "KLFT",
    "iata": "LFT",
    "name": "Lafayette Regional",
    "state": "LA",
    "lat": 30.2053,
    "lon": -91.9876
  },
  {
    "icao": "KMLU",
    "iata": "MLU",
    "name": "Monroe Regional",
    "state": "LA",
    "lat": 32.5109,
    "lon": -92.0377
  },
  {
    "icao": "KICT",
    "iata": "ICT",
    "name": "Wichita Dwight D. Eisenhower National",
    "state": "KS",
    "lat": 37.6499,
    "lon": -97.4331
  },
  {
    "icao": "KMHK",
    "iata": "MHK",
    "name": "Manhattan Regional",
    "state": "KS",
    "lat": 39.141,
    "lon": -96.6708
  },
  {
    "icao": "KSGF",
    "iata": "SGF",
    "name": "Springfield-Branson National",
    "state": "MO",
    "lat": 37.2457,
    "lon": -93.3886
  },
  {
    "icao": "KCOU",
    "iata": "COU",
    "name": "Columbia Regional",
    "state": "MO",
    "lat": 38.8181,
    "lon": -92.2196
  },
  {
    "icao": "KMCI",
    "iata": "MCI",
    "name": "Kansas City Intl",
    "state": "MO",
    "lat": 39.2976,
    "lon": -94.7139
  },
  {
    "icao": "KSTJ",
    "iata": "STJ",
    "name": "Rosecrans Memorial",
    "state": "MO",
    "lat": 39.7719,
    "lon": -94.9097
  },
  {
    "icao": "KTOL",
    "iata": "TOL",
    "name": "Toledo Express",
    "state": "OH",
    "lat": 41.5868,
    "lon": -83.8078
  },
  {
    "icao": "KERI",
    "iata": "ERI",
    "name": "Erie Intl",
    "state": "PA",
    "lat": 42.0831,
    "lon": -80.1739
  },
  {
    "icao": "KBDL",
    "iata": "BDL",
    "name": "Bradley Intl",
    "state": "CT",
    "lat": 41.9389,
    "lon": -72.6832
  },
  {
    "icao": "KPVD",
    "iata": "PVD",
    "name": "Rhode Island T. F. Green Intl",
    "state": "RI",
    "lat": 41.724,
    "lon": -71.4282
  },
  {
    "icao": "KMHT",
    "iata": "MHT",
    "name": "Manchester-Boston Regional",
    "state": "NH",
    "lat": 42.9326,
    "lon": -71.4357
  },
  {
    "icao": "KACY",
    "iata": "ACY",
    "name": "Atlantic City Intl",
    "state": "NJ",
    "lat": 39.4576,
    "lon": -74.5772
  },
  {
    "icao": "KTTN",
    "iata": "TTN",
    "name": "Trenton-Mercer",
    "state": "NJ",
    "lat": 40.2767,
    "lon": -74.8135
  },
  {
    "icao": "KILG",
    "iata": "ILG",
    "name": "Wilmington",
    "state": "DE",
    "lat": 39.6787,
    "lon": -75.6065
  },
  {
    "icao": "KCRW",
    "iata": "CRW",
    "name": "West Virginia Intl Yeager",
    "state": "WV",
    "lat": 38.3731,
    "lon": -81.5932
  },
  {
    "icao": "KHTS",
    "iata": "HTS",
    "name": "Tri-State",
    "state": "WV",
    "lat": 38.3667,
    "lon": -82.5579
  },
  {
    "icao": "KTRI",
    "iata": "TRI",
    "name": "Tri-Cities Regional",
    "state": "TN",
    "lat": 36.4752,
    "lon": -82.4074
  },
  {
    "icao": "KGSO",
    "iata": "GSO",
    "name": "Piedmont Triad Intl",
    "state": "NC",
    "lat": 36.0978,
    "lon": -79.9373
  },
  {
    "icao": "KGRB",
    "iata": "GRB",
    "name": "Green Bay Austin Straubel Intl",
    "state": "WI",
    "lat": 44.4851,
    "lon": -88.1296
  },
  {
    "icao": "KATW",
    "iata": "ATW",
    "name": "Appleton Intl",
    "state": "WI",
    "lat": 44.2581,
    "lon": -88.5191
  },
  {
    "icao": "KCWA",
    "iata": "CWA",
    "name": "Central Wisconsin",
    "state": "WI",
    "lat": 44.7776,
    "lon": -89.6668
  },
  {
    "icao": "KCMX",
    "iata": "CMX",
    "name": "Houghton County Memorial",
    "state": "MI",
    "lat": 47.1684,
    "lon": -88.4891
  },
  {
    "icao": "KDLH",
    "iata": "DLH",
    "name": "Duluth Intl",
    "state": "MN",
    "lat": 46.8421,
    "lon": -92.1936
  },
  {
    "icao": "KRST",
    "iata": "RST",
    "name": "Rochester Intl",
    "state": "MN",
    "lat": 43.9083,
    "lon": -92.5
  },
  {
    "icao": "KATY",
    "iata": "ATY",
    "name": "Watertown Regional",
    "state": "SD",
    "lat": 44.914,
    "lon": -97.1547
  },
  {
    "icao": "KMQT",
    "iata": "MQT",
    "name": "Sawyer Intl",
    "state": "MI",
    "lat": 46.3536,
    "lon": -87.3954
  },
  {
    "icao": "KBGR",
    "iata": "BGR",
    "name": "Bangor Intl",
    "state": "ME",
    "lat": 44.8074,
    "lon": -68.8281
  },
  {
    "icao": "KBHB",
    "iata": "BHB",
    "name": "Hancock County-Bar Harbor",
    "state": "ME",
    "lat": 44.45,
    "lon": -68.3617
  },
  {
    "icao": "KFAI",
    "iata": "FAI",
    "name": "Fairbanks Intl",
    "state": "AK",
    "lat": 64.8151,
    "lon": -147.856
  },
  {
    "icao": "PANC",
    "iata": "ANC",
    "name": "Ted Stevens Anchorage Intl",
    "state": "AK",
    "lat": 61.1743,
    "lon": -149.9985
  },
  {
    "icao": "PAJN",
    "iata": "JNU",
    "name": "Juneau Intl",
    "state": "AK",
    "lat": 58.3549,
    "lon": -134.5763
  },
  {
    "icao": "PABE",
    "iata": "BET",
    "name": "Bethel",
    "state": "AK",
    "lat": 60.7798,
    "lon": -161.838
  },
  {
    "icao": "PAKT",
    "iata": "KTN",
    "name": "Ketchikan Intl",
    "state": "AK",
    "lat": 55.3556,
    "lon": -131.7137
  },
  {
    "icao": "PAGS",
    "iata": "GST",
    "name": "Gustavus",
    "state": "AK",
    "lat": 58.4253,
    "lon": -135.7074
  },
  {
    "icao": "PAOM",
    "iata": "OME",
    "name": "Nome",
    "state": "AK",
    "lat": 64.5122,
    "lon": -165.4453
  },
  {
    "icao": "PHOG",
    "iata": "OGG",
    "name": "Kahului",
    "state": "HI",
    "lat": 20.8986,
    "lon": -156.4305
  },
  {
    "icao": "PHKO",
    "iata": "KOA",
    "name": "Ellison Onizuka Kona Intl",
    "state": "HI",
    "lat": 19.7388,
    "lon": -156.0456
  },
  {
    "icao": "PHLI",
    "iata": "LIH",
    "name": "Lihue",
    "state": "HI",
    "lat": 21.9759,
    "lon": -159.3389
  },
  {
    "icao": "PHNY",
    "iata": "LNY",
    "name": "Lanai",
    "state": "HI",
    "lat": 20.7856,
    "lon": -156.9514
  },
  {
    "icao": "PHTO",
    "iata": "ITO",
    "name": "Hilo Intl",
    "state": "HI",
    "lat": 19.7214,
    "lon": -155.0485
  },
  {
    "icao": "TJSJ",
    "iata": "SJU",
    "name": "Luis Munoz Marin Intl",
    "state": "PR",
    "lat": 18.4394,
    "lon": -66.0018
  },
  {
    "icao": "TJBQ",
    "iata": "BQN",
    "name": "Rafael Hernandez",
    "state": "PR",
    "lat": 18.4949,
    "lon": -67.1294
  }
];

module.exports = { AIRPORTS };
