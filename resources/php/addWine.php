<?php
  // 1. Include dependencies at the top
  require_once 'securityHeaders.php';
  require_once 'databaseConnection.php';
  require_once 'audit_log.php';
  require_once 'validators.php';
  require_once 'errorHandler.php';

  // Start session if not already started
  if (session_status() === PHP_SESSION_NONE) {
      session_start();
  }
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
    $existingWineRegion = trim($data['findRegion']) ?? null;
    $newWineRegion = trim($data['regionName']) ?? null;
    if (empty($newWineRegion) && empty($existingWineRegion)) {
      throw new Exception('New or existing Region is required');
    }

    $newProducerName = trim($data['producerName']) ?? null;
    $existingWineProducer = trim($data['findProducer']) ?? null;
    if (empty($newProducerName) && empty($existingWineProducer)) {
        throw new Exception('New or existing Producer is required');
    }

    $newWineName = validateStringField($data['wineName'] ?? null, 'Wine name', false, 50);
    $existingWineName = trim($data['findWine']) ?? null;
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


    $bottleType = validateStringField($data['bottleType'] ?? '', 'Bottle size', true, 50);
    $storageLocation = validateStringField($data['storageLocation'] ?? '', 'Storage location', true, 50);
    $bottleSource = validateStringField($data['bottleSource'] ?? '', 'Source', true, 50);
    $priceCurrency = validatePriceCurrency($data['bottlePrice'] ?? null, $data['bottleCurrency'] ?? null);
    $bottlePrice = $priceCurrency['price'];
    $bottleCurrency = $priceCurrency['currency'];
    $bottlePurchaseDate = validatePurchaseDate($data['bottlePurchaseDate'] ?? null);

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

    $wineDescription = trim($data['wineDescription']) ?? null;
    $wineTasting = trim($data['wineTasting']) ?? null;
    $winePairing = trim($data['winePairing']) ?? null;
    $winePicture = trim($data['winePicture']) ?? null;
    $wineType = trim($data['wineType']) ?? null;
    $appellation = !empty($data['appellation']) ? trim($data['appellation']) : null;  // WIN-148: Specific appellation

    // WIN-144: Enrichment data
    $drinkWindowStart = !empty($data['drinkWindowStart']) ? (int)$data['drinkWindowStart'] : null;
    $drinkWindowEnd = !empty($data['drinkWindowEnd']) ? (int)$data['drinkWindowEnd'] : null;
    $grapes = isset($data['grapes']) && is_array($data['grapes']) ? array_slice($data['grapes'], 0, 20) : [];
    $criticScores = isset($data['criticScores']) && is_array($data['criticScores']) ? array_slice($data['criticScores'], 0, 10) : [];

    // Validate drink window years (MySQL YEAR type: 1901-2155)
    if ($drinkWindowStart !== null && ($drinkWindowStart < 1901 || $drinkWindowStart > 2155)) {
        $drinkWindowStart = null;
    }
    if ($drinkWindowEnd !== null && ($drinkWindowEnd < 1901 || $drinkWindowEnd > 2155)) {
        $drinkWindowEnd = null;
    }

    $pdo->beginTransaction();

      //there should always be a check, what happens if this ocde is repeated for some reason
      //after the insert succeeded
      
          
      //try and find the region input - either new or existing (exclude soft-deleted)
      $stmt = $pdo->prepare("
                              SELECT regionID FROM region
                              WHERE LOWER(regionName) COLLATE utf8mb4_unicode_ci = LOWER(:region) COLLATE utf8mb4_unicode_ci
                              AND deleted = 0
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
        logInsert($pdo, 'region', $regionID, [
            'regionName' => $newWineRegion,
            'countryID' => $countryID,
            'description' => $regionDescription,
            'climate' => $regionClimate,
            'soil' => $regionSoil,
            'map' => $regionMap
        ]);
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
      
      //try and find the producer input - either new or existing (exclude soft-deleted)
      $stmt = $pdo->prepare("
                              SELECT producerID FROM producers
                              WHERE LOWER(producerName) COLLATE utf8mb4_unicode_ci = LOWER(:wineProducer) COLLATE utf8mb4_unicode_ci
                              AND deleted = 0
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
        logInsert($pdo, 'producers', $producerID, [
            'producerName' => $newProducerName,
            'regionID' => $regionID,
            'town' => $producerTown,
            'founded' => $producerFounded,
            'ownership' => $producerOwnership,
            'description' => $producerDescription
        ]);
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

        //try and find the wine input - either new or existing (exclude soft-deleted)
      $stmt = $pdo->prepare("
                              SELECT wineID FROM wine
                              WHERE LOWER(wineName) COLLATE utf8mb4_unicode_ci = LOWER(:wineName) COLLATE utf8mb4_unicode_ci
                              AND producerID = :producerID
                              AND deleted = 0
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

      $isNewWine = false;  // WIN-144: Track whether we created a new wine
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

        // WIN-144: Determine enrichment status from data presence (not from frontend)
        $hasEnrichmentData = !empty($wineDescription) || !empty($wineTasting) || !empty($winePairing)
            || !empty($grapes) || !empty($criticScores)
            || $drinkWindowStart !== null || $drinkWindowEnd !== null;
        $enrichmentStatus = $hasEnrichmentData ? 'complete' : 'pending';

        $stmt = $pdo->prepare("INSERT INTO `wine` (wineName, wineTypeID, producerID, year, isNonVintage, appellation, description, tastingNotes, pairing, pictureURL, enrichment_status, drinkWindowStart, drinkWindowEnd)
                                VALUES (:wineName, :wineTypeID, :producerID, :wineYear, :isNonVintage, :appellation, :wineDescription, :wineTasting, :winePairing, :winePicture, :enrichmentStatus, :drinkWindowStart, :drinkWindowEnd)");

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
            ':winePicture' => $winePicture,
            ':enrichmentStatus' => $enrichmentStatus,
            ':drinkWindowStart' => $drinkWindowStart,
            ':drinkWindowEnd' => $drinkWindowEnd,
        ]);

        $wineID = $pdo->lastInsertId();
        logInsert($pdo, 'wine', $wineID, [
            'wineName' => $newWineName,
            'wineTypeID' => $wineTypeID,
            'producerID' => $producerID,
            'year' => $wineYear,
            'isNonVintage' => $isNonVintage,
            'appellation' => $appellation,
            'description' => $wineDescription,
            'tastingNotes' => $wineTasting,
            'pairing' => $winePairing,
            'pictureURL' => $winePicture,
            'enrichment_status' => $enrichmentStatus,
            'drinkWindowStart' => $drinkWindowStart,
            'drinkWindowEnd' => $drinkWindowEnd,
        ]);
        $isNewWine = true;
        $output .= " - New Wine added ($newWineName)";

      } else {
        //There was a wine already there and we used it
        $output .= " - Wine selected (ID - {$wineID}) " . ($newWineName ?: $existingWineName);
      }

      // WIN-144: Insert grape composition (only for new wines with enrichment data)
      if ($wineID && !empty($grapes) && $isNewWine) {
          foreach ($grapes as $grapeEntry) {
              $grapeName = isset($grapeEntry['grape']) ? trim($grapeEntry['grape']) : '';
              if (empty($grapeName) || strlen($grapeName) > 50) continue;

              $percentage = isset($grapeEntry['percentage']) ? (int)$grapeEntry['percentage'] : null;
              if ($percentage !== null && ($percentage < 0 || $percentage > 100)) $percentage = null;

              // Find or create grape (UNIQUE constraint from migration)
              $stmt = $pdo->prepare("INSERT INTO grapes (grapeName, description, picture) VALUES (:name, '', '')
                                     ON DUPLICATE KEY UPDATE grapeID = LAST_INSERT_ID(grapeID)");
              $stmt->execute([':name' => $grapeName]);
              $grapeID = $pdo->lastInsertId();

              // Insert into grapemix
              $stmt = $pdo->prepare("INSERT INTO grapemix (wineID, grapeID, mixPercent) VALUES (:wineID, :grapeID, :percent)");
              $stmt->execute([
                  ':wineID' => $wineID,
                  ':grapeID' => $grapeID,
                  ':percent' => $percentage,
              ]);

              logInsert($pdo, 'grapemix', $pdo->lastInsertId(), [
                  'wineID' => $wineID,
                  'grapeID' => $grapeID,
                  'mixPercent' => $percentage,
              ]);
          }
      }

      // WIN-144: Insert critic scores (only for new wines with enrichment data)
      if ($wineID && !empty($criticScores) && $isNewWine) {
          foreach ($criticScores as $scoreEntry) {
              $critic = isset($scoreEntry['critic']) ? trim($scoreEntry['critic']) : '';
              if (empty($critic) || strlen($critic) > 50) continue;

              $score = validateRating($scoreEntry['score'] ?? null, 'Critic score', false, 50, 100);
              if ($score === null) continue;

              $scoreYear = isset($scoreEntry['scoreYear']) ? (int)$scoreEntry['scoreYear'] : null;
              if ($scoreYear !== null && ($scoreYear < 1901 || $scoreYear > 2155)) $scoreYear = null;

              $stmt = $pdo->prepare("INSERT INTO critic_scores (wineID, critic, score, scoreYear, source)
                                     VALUES (:wineID, :critic, :score, :scoreYear, 'agent_enrichment')");
              $stmt->execute([
                  ':wineID' => $wineID,
                  ':critic' => $critic,
                  ':score' => $score,
                  ':scoreYear' => $scoreYear,
              ]);

              logInsert($pdo, 'critic_scores', $pdo->lastInsertId(), [
                  'wineID' => $wineID,
                  'critic' => $critic,
                  'score' => $score,
                  'scoreYear' => $scoreYear,
                  'source' => 'agent_enrichment',
              ]);
          }
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
      logInsert($pdo, 'bottles', $bottleID, [
          'wineID' => $wineID,
          'bottleSize' => $bottleType,
          'location' => $storageLocation,
          'source' => $bottleSource,
          'price' => $bottlePrice,
          'currency' => $bottleCurrency,
          'purchaseDate' => $bottlePurchaseDate
      ]);
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
