<?php
  // 1. Include dependencies at the top
  require_once 'securityHeaders.php';
  require_once 'databaseConnection.php';
  require_once 'audit_log.php';
  require_once 'validators.php';
  require_once 'errorHandler.php';

  // 2. Initialize response
  $response = ['success' => false, 'message' => '', 'data' => null];
  $output = "";

  try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Get and validate input
    $data = json_decode(file_get_contents('php://input'), true);

    //Region and producer information must be present to add a wine
    //At least one needs to be there - new or exisiting
    $existingWineRegion = trim($data['findRegion']);
    $newWineRegion = trim($data['regionName']);
    if (empty($newWineRegion) && empty($existingWineRegion)) {
      throw new Exception('New or existing Region is required');
    }

    $newProducerName = trim($data['producerName']);
    $existingWineProducer = trim($data['findProducer']);
    if (empty($newProducerName) && empty($existingWineProducer)) {
        throw new Exception('New or existing Producer is required');
    }

    $newWineName = trim($data['wineName']);
    $existingWineName = trim($data['findWine']);
    if (empty($newWineName) && empty($existingWineName)) {
        throw new Exception('New or existing Wine Name is required');
    }

    //Region information
    $regionCountry = trim($data['regionCountry'] ?? null);
    $regionDescription = trim($data['regionDescription'] ?? null);
    $regionClimate = trim($data['regionClimate'] ?? null);
    $regionSoil = trim($data['regionSoil'] ?? null);
    $regionMap = trim($data['regionMap'] ?? null);

    //Producer information
    $producerTown = trim($data['producerTown'] ?? null);
    $producerFounded = trim($data['producerFounded'] ?? null);
    $producerOwnership = trim($data['producerOwnership'] ?? null);
    $producerDescription = trim($data['producerDescription'] ?? null);


    $bottleType = trim($data['bottleType']);
    if (empty($bottleType)) {
        throw new Exception('Bottle name is required');
    }
    $storageLocation = trim($data['storageLocation']);
    if (empty($storageLocation)) {
        throw new Exception('Storage location is required');
    }
    $bottleSource = trim($data['bottleSource']);
    if (empty($bottleSource)) {
        throw new Exception('Bottle source is required');
    }
    $bottlePrice = trim($data['bottlePrice'] ?? null);
    $bottleCurrency = trim($data['bottleCurrency'] ?? null);
    $bottlePurchaseDate = !empty($data['bottlePurchaseDate']) ? trim($data['bottlePurchaseDate']) : null;

    // WIN-176: Handle year and Non-Vintage flag
    $yearInput = trim($data['wineYear'] ?? '');
    $isNonVintageInput = !empty($data['isNonVintage']);

    if ($isNonVintageInput) {
      $wineYear = null;
      $isNonVintage = 1;
    } else {
      $yearData = validateWineYear($yearInput);
      $wineYear = $yearData['year'];
      $isNonVintage = $yearData['isNonVintage'] ? 1 : 0;
    }

    $wineDescription = trim($data['wineDescription']);
    $wineTasting = trim($data['wineTasting']);
    $winePairing = trim($data['winePairing']);
    $winePicture = trim($data['winePicture']);
    $wineType = trim($data['wineType']);
    $appellation = !empty($data['appellation']) ? trim($data['appellation']) : null;  // WIN-148: Specific appellation

    $pdo->beginTransaction();

      //there should always be a check, what happens if this ocde is repeated for some reason
      //after the insert succeeded


      //try and find the region input - either new or existing
      $stmt = $pdo->prepare("
                              SELECT regionID FROM region
                              WHERE LOWER(regionName) COLLATE utf8mb4_unicode_ci = LOWER(:region) COLLATE utf8mb4_unicode_ci
                          ");

      //Choose which value to search for - either new or existing
      if (!empty($existingWineRegion) ) {
        $stmt->execute([':region' => $existingWineRegion]);
      } else {
        $stmt->execute([':region' => $newWineRegion]);
      }
      //Grab the ID
      $regionID  = $stmt->fetchColumn();

      //if the region is found (non false region ID) then use the ID and move to producer
      //if the region is not found, then try adding it

      if ($regionID === false && empty($newWineRegion)) {
        //we expect a new region  if we are adding a region, so throw an error if there is no new
        throw new Exception("Region not found, and no new region name given");
      } elseif ($regionID === false && !empty($newWineRegion)){
        //add the region as we know it is new and new region data is there

        //TODO: this query could be replaced by have the ID in the front end
        $stmt = $pdo->prepare("SELECT countryID FROM country WHERE countryName = :regionCountry");
        $stmt->execute([':regionCountry' => $regionCountry]);
        $countryID = $stmt->fetchColumn();

        // Check if country exists
        if ($countryID === false) {
            throw new Exception("Country not found");
        }

        // Insert the region
        $stmt = $pdo->prepare("INSERT INTO region (regionName, countryID, description, climate, soil, map)
            VALUES (:regionName, :countryID, :regionDescription, :regionClimate, :regionSoil, :regionMap)");

        $stmt->execute([
            ':regionName' => $newWineRegion,
            ':countryID' => $countryID,
            ':regionDescription' => $regionDescription,
            ':regionClimate' => $regionClimate,
            ':regionSoil' => $regionSoil,
            ':regionMap' => $regionMap
        ]);
        $regionID = $pdo->lastInsertId();
        $output .= "New Region added ($newWineRegion)";
      } else {
        //There was a region already there and we used it
        $output .= "Region selected (ID - {$regionID}) " . ($newWineRegion ?: $existingWineRegion);
      }

      ////////////\\\\\\\\\\\\
      //                    \\
      // Move onto Producer \\
      //                    \\
      ////////////\\\\\\\\\\\\

      //try and find the producer input - either new or existing
      $stmt = $pdo->prepare("
                              SELECT producerID FROM producers
                              WHERE LOWER(producerName) COLLATE utf8mb4_unicode_ci = LOWER(:wineProducer) COLLATE utf8mb4_unicode_ci
                          ");

      //Choose which value to search for - either new or existing
      if (!empty($existingWineProducer) ) {
        $stmt->execute([':wineProducer' => $existingWineProducer]);
      } else {
        $stmt->execute([':wineProducer' => $newProducerName]);
      }
      //Grab the ID
      $producerID  = $stmt->fetchColumn();

      //if the producer is found (non false producer ID) then use the ID and move to wine
      //if the producer is not found, then try adding it

      if ($producerID === false && empty($newProducerName)) {
        //we expect a new prodcuer if we are adding a producer, so throw an error if there is no new
        throw new Exception("Producer not found, and no new producer name given");
      } elseif ($producerID === false && !empty($newProducerName)){
        //add the producer as we know it is new and new producer data is there
        $stmt = $pdo->prepare("INSERT INTO producers (producerName, regionID, town, founded, ownership, description)
                                VALUES (:producerName, :regionID, :producerTown, :producerFounded, :producerOwnership, :producerDescription)");

        $stmt->execute([
          ':producerName' => $newProducerName,
          ':regionID' => $regionID,
          ':producerTown' => $producerTown,
          ':producerFounded' => $producerFounded,
          ':producerOwnership' => $producerOwnership,
          ':producerDescription' => $producerDescription
        ]);

        $producerID = $pdo->lastInsertId();
        $output .= " - New Producer added ($newProducerName)";
      } else {
        //There was a producer already there and we used it
        $output .= " - Producer selected (ID - {$producerID}) " . ($newProducerName ?: $existingWineProducer);
      }

      //////////\\\\\\\\\\
      //                \\
      // Move onto Wine \\
      //                \\
      //////////\\\\\\\\\\

        //try and find the producer input - either new or existing
      $stmt = $pdo->prepare("
                              SELECT wineID FROM wine
                              WHERE LOWER(wineName) COLLATE utf8mb4_unicode_ci = LOWER(:wineName) COLLATE utf8mb4_unicode_ci
                              AND producerID = :producerID
                          ");

      //Choose which value to search for - either new or existing
      if (!empty($existingWineName) ) {
        $stmt->execute([
                        ':wineName' => $existingWineName,
                        ':producerID' => $producerID
                      ]);
      } else {
        $stmt->execute([
                        ':wineName' => $newWineName,
                        ':producerID' => $producerID
                      ]);
      }
      //Grab the ID
      $wineID  = $stmt->fetchColumn();

      //if the wine is found (non false wine ID) then use the ID and move to the bottle
      //if the wine is not found, then try adding it

      if ($wineID === false && empty($newWineName)) {
        //we expect a new wine  if we are adding a wine, so throw an error if there is no new
        throw new Exception("Wine not found, and no new wine name given");
      } elseif ($wineID === false && !empty($newWineName)){

        //Get the wine type
        //TODO: this query could be replaced by have the ID in the front end
        $stmt = $pdo->prepare("SELECT wineTypeID FROM winetype WHERE wineType = :wineType");
        $stmt->execute([':wineType' => $wineType]);
        $wineTypeID = $stmt->fetchColumn();

        // Check if wine type exists
        if ($wineTypeID === false) {
            throw new Exception("Wine type not found");
        }

        //add the wine  as we know it is new and new wine data is there

        $stmt = $pdo->prepare("INSERT INTO `wine` (wineName, wineTypeID, producerID, year, isNonVintage, appellation, description, tastingNotes, pairing, pictureURL, enrichment_status)
                                VALUES (:wineName, :wineTypeID, :producerID, :wineYear, :isNonVintage, :appellation, :wineDescription, :wineTasting, :winePairing, :winePicture, 'pending')");

        $stmt->execute([
            ':wineName' => $newWineName,
            ':wineTypeID' => $wineTypeID,
            ':producerID' => $producerID,
            ':wineYear' => $wineYear,
            ':isNonVintage' => $isNonVintage,  // WIN-176: Non-Vintage flag
            ':appellation' => $appellation,  // WIN-148: Specific appellation
            ':wineDescription' => $wineDescription,
            ':wineTasting' => $wineTasting,
            ':winePairing' => $winePairing,
            ':winePicture' => $winePicture
        ]);

        $wineID = $pdo->lastInsertId();
        $output .= " - New Wine added ($newWineName)";

      } else {
        //There was a wine already there and we used it
        $output .= " - Wine selected (ID - {$wineID}) " . ($newWineName ?: $existingWineName);
      }

      /////////////\\\\\\\\\\\\\
      //                      \\
      // Move onto the bottle \\
      //                      \\
      /////////////\\\\\\\\\\\\\
      $stmt = $pdo->prepare("INSERT INTO bottles (wineID, bottleSize, location, source, price, currency, purchaseDate, dateAdded)
                            VALUES (:wineID, :bottleType, :storageLocation, :bottleSource, :bottlePrice, :bottleCurrency, :bottlePurchaseDate, CURDATE())");
      $stmt->execute([
                    ':wineID' => $wineID,
                    ':bottleType' => $bottleType,
                    ':storageLocation' => $storageLocation,
                    ':bottleSource' => $bottleSource,
                    ':bottlePrice' => $bottlePrice,
                    ':bottleCurrency' => $bottleCurrency,
                    ':bottlePurchaseDate' => $bottlePurchaseDate
                    ]);
      //need much more detailed output...should be a json of the wine or json of the error.
      //Also need different try catches, maybe the region works, but the otherone doesn't
      $bottleID = $pdo->lastInsertId();
      $output = $output . ' - bottle is added' ;

    //Try and commit everything
    $pdo->commit();

    $response['success'] = true;
    $response['message'] = 'Wine added sucessfully! ' . $output;
    //DOes this need to always be wineList in the JS?
    $response['data'] = ['bottleID' => $bottleID,'wineID' => $wineID];

  } catch (Exception $e) {
    //Handle all errors
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
      $response['success'] = false;
      // WIN-217: sanitize error messages - don't leak $output or internal details
      $response['message'] = safeErrorMessage($e, 'addWine');
      error_log("addWine progress before error: " . $output);
  }

  //Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
?>
