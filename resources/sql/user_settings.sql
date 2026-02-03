-- User Settings Table
-- Stores key-value pairs for user preferences (collection name, etc.)
-- Created for WIN-126 and WIN-127

CREATE TABLE IF NOT EXISTS `user_settings` (
  `settingID` int NOT NULL AUTO_INCREMENT,
  `settingKey` varchar(50) NOT NULL,
  `settingValue` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settingID`),
  UNIQUE KEY `unique_setting_key` (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default collection name
INSERT INTO `user_settings` (`settingKey`, `settingValue`)
VALUES ('collectionName', 'Our Wines')
ON DUPLICATE KEY UPDATE `settingValue` = `settingValue`;
