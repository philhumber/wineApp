-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jan 11, 2026 at 10:47 PM
-- Server version: 8.0.44-0ubuntu0.24.04.2
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `winelist`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `auditID` int NOT NULL,
  `tableName` varchar(50) NOT NULL,
  `recordID` int NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `columnName` varchar(50) DEFAULT NULL,
  `oldValue` text,
  `newValue` text,
  `changedBy` int DEFAULT NULL,
  `changedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ipAddress` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bottles`
--

CREATE TABLE `bottles` (
  `bottleID` int NOT NULL,
  `wineID` int NOT NULL,
  `bottleSize` varchar(50) NOT NULL,
  `location` varchar(50) NOT NULL,
  `source` varchar(50) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` char(3) DEFAULT NULL,
  `dateAdded` date NOT NULL,
  `bottleDrunk` tinyint(1) NOT NULL DEFAULT '0',
  `deleted` tinyint DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `country`
--

CREATE TABLE `country` (
  `countryID` int NOT NULL,
  `countryName` varchar(255) NOT NULL,
  `code` char(2) NOT NULL COMMENT 'Two-letter country code (ISO 3166-1 alpha-2)',
  `world_code` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL COMMENT 'Full English country name',
  `iso3` char(3) NOT NULL COMMENT 'Three-letter country code (ISO 3166-1 alpha-3)',
  `number` char(3) NOT NULL COMMENT 'Three-digit country number (ISO 3166-1 numeric)',
  `continent` char(2) NOT NULL COMMENT 'Two-letter continent code (ISO 3166-1 alpha-2)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `grapemix`
--

CREATE TABLE `grapemix` (
  `mixID` int NOT NULL,
  `wineID` int NOT NULL,
  `grapeID` int NOT NULL,
  `mixPercent` decimal(10,0) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `grapes`
--

CREATE TABLE `grapes` (
  `grapeID` int NOT NULL,
  `grapeName` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `picture` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `producers`
--

CREATE TABLE `producers` (
  `producerID` int NOT NULL,
  `producerName` varchar(255) NOT NULL,
  `regionID` int NOT NULL,
  `town` varchar(255) NOT NULL,
  `founded` int NOT NULL,
  `ownership` varchar(255) NOT NULL,
  `description` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `ratingID` int NOT NULL,
  `wineID` int NOT NULL,
  `bottleID` int NOT NULL,
  `overallRating` int NOT NULL,
  `valueRating` int NOT NULL,
  `drinkDate` date NOT NULL,
  `buyAgain` tinyint(1) NOT NULL,
  `Notes` text NOT NULL,
  `avgRating` decimal(4,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `region`
--

CREATE TABLE `region` (
  `regionID` int NOT NULL,
  `regionName` varchar(50) NOT NULL,
  `countryID` int NOT NULL,
  `description` text NOT NULL,
  `climate` text NOT NULL,
  `soil` text NOT NULL,
  `map` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wine`
--

CREATE TABLE `wine` (
  `wineID` int NOT NULL,
  `wineName` varchar(50) NOT NULL,
  `wineTypeID` int NOT NULL,
  `producerID` int NOT NULL,
  `year` year DEFAULT NULL,
  `description` text NOT NULL,
  `tastingNotes` text NOT NULL,
  `pairing` text NOT NULL,
  `pictureURL` text NOT NULL,
  `ABV` decimal(10,0) DEFAULT NULL,
  `drinkDate` year DEFAULT NULL,
  `rating` decimal(10,0) DEFAULT NULL,
  `bottlesDrunk` int DEFAULT '0',
  `deleted` tinyint DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `winetype`
--

CREATE TABLE `winetype` (
  `wineTypeID` int NOT NULL,
  `wineType` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `worlds`
--

CREATE TABLE `worlds` (
  `name` varchar(255) NOT NULL COMMENT 'Wine World'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`auditID`),
  ADD KEY `tableName` (`tableName`,`recordID`),
  ADD KEY `changedAt` (`changedAt`);

--
-- Indexes for table `bottles`
--
ALTER TABLE `bottles`
  ADD PRIMARY KEY (`bottleID`),
  ADD KEY `fk_bottle_wineID` (`wineID`),
  ADD KEY `idx_deleted` (`deleted`);

--
-- Indexes for table `country`
--
ALTER TABLE `country`
  ADD PRIMARY KEY (`countryID`),
  ADD UNIQUE KEY `countryName` (`countryName`),
  ADD KEY `fk_country_world` (`world_code`);

--
-- Indexes for table `grapemix`
--
ALTER TABLE `grapemix`
  ADD PRIMARY KEY (`mixID`),
  ADD KEY `fk_grapeMix_wineID` (`wineID`),
  ADD KEY `fk_grapeMix_grapeID` (`grapeID`);

--
-- Indexes for table `grapes`
--
ALTER TABLE `grapes`
  ADD PRIMARY KEY (`grapeID`);

--
-- Indexes for table `producers`
--
ALTER TABLE `producers`
  ADD PRIMARY KEY (`producerID`),
  ADD UNIQUE KEY `producerName` (`producerName`),
  ADD KEY `fk_producer_region` (`regionID`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`ratingID`),
  ADD KEY `fk_rating_bottle` (`bottleID`),
  ADD KEY `fk_rating_wine` (`wineID`);

--
-- Indexes for table `region`
--
ALTER TABLE `region`
  ADD PRIMARY KEY (`regionID`),
  ADD UNIQUE KEY `regionName` (`regionName`),
  ADD KEY `fk_region_country` (`countryID`);

--
-- Indexes for table `wine`
--
ALTER TABLE `wine`
  ADD PRIMARY KEY (`wineID`),
  ADD KEY `fk_wine_producerID` (`producerID`),
  ADD KEY `fk_wine_wineTypeID` (`wineTypeID`),
  ADD KEY `idx_deleted` (`deleted`);

--
-- Indexes for table `winetype`
--
ALTER TABLE `winetype`
  ADD PRIMARY KEY (`wineTypeID`);

--
-- Indexes for table `worlds`
--
ALTER TABLE `worlds`
  ADD PRIMARY KEY (`name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `auditID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bottles`
--
ALTER TABLE `bottles`
  MODIFY `bottleID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `country`
--
ALTER TABLE `country`
  MODIFY `countryID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `grapemix`
--
ALTER TABLE `grapemix`
  MODIFY `mixID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `grapes`
--
ALTER TABLE `grapes`
  MODIFY `grapeID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `producers`
--
ALTER TABLE `producers`
  MODIFY `producerID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `ratingID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `region`
--
ALTER TABLE `region`
  MODIFY `regionID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wine`
--
ALTER TABLE `wine`
  MODIFY `wineID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `winetype`
--
ALTER TABLE `winetype`
  MODIFY `wineTypeID` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bottles`
--
ALTER TABLE `bottles`
  ADD CONSTRAINT `fk_bottle_wineID` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `country`
--
ALTER TABLE `country`
  ADD CONSTRAINT `fk_country_world` FOREIGN KEY (`world_code`) REFERENCES `worlds` (`name`) ON DELETE RESTRICT;

--
-- Constraints for table `grapemix`
--
ALTER TABLE `grapemix`
  ADD CONSTRAINT `fk_grapeMix_grapeID` FOREIGN KEY (`grapeID`) REFERENCES `grapes` (`grapeID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_grapeMix_wineID` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `producers`
--
ALTER TABLE `producers`
  ADD CONSTRAINT `fk_producer_region` FOREIGN KEY (`regionID`) REFERENCES `region` (`regionID`) ON DELETE RESTRICT;

--
-- Constraints for table `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `fk_rating_bottle` FOREIGN KEY (`bottleID`) REFERENCES `bottles` (`bottleID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_rating_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `region`
--
ALTER TABLE `region`
  ADD CONSTRAINT `fk_region_country` FOREIGN KEY (`countryID`) REFERENCES `country` (`countryID`) ON DELETE RESTRICT;

--
-- Constraints for table `wine`
--
ALTER TABLE `wine`
  ADD CONSTRAINT `fk_wine_producerID` FOREIGN KEY (`producerID`) REFERENCES `producers` (`producerID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_wine_wineTypeID` FOREIGN KEY (`wineTypeID`) REFERENCES `winetype` (`wineTypeID`) ON DELETE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
