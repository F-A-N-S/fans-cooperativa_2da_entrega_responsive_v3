-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 07, 2025 at 11:57 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `fans_cooperativa`
--

-- --------------------------------------------------------

--
-- Table structure for table `administrador`
--

CREATE TABLE `administrador` (
  `id_Administrador` int(11) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Apellido` varchar(100) NOT NULL,
  `Usuario` varchar(50) NOT NULL,
  `Correo` varchar(120) DEFAULT NULL,
  `Contrasena` varchar(255) NOT NULL,
  `estado_aprobacion` tinyint(1) DEFAULT 0,
  `fecha_registro` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `administrador`
--

INSERT INTO `administrador` (`id_Administrador`, `Nombre`, `Apellido`, `Usuario`, `Correo`, `Contrasena`, `estado_aprobacion`, `fecha_registro`) VALUES
(1, 'Admin', 'Principal', 'admin', 'admin@fans.test', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, '2025-11-07 14:21:50');

-- --------------------------------------------------------

--
-- Table structure for table `auth_tokens`
--

CREATE TABLE `auth_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` enum('residente','admin') NOT NULL DEFAULT 'residente',
  `user_role` enum('admin','residente') NOT NULL DEFAULT 'residente',
  `token_hash` char(64) DEFAULT NULL,
  `token` char(64) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auth_tokens`
--

INSERT INTO `auth_tokens` (`id`, `user_id`, `role`, `user_role`, `token_hash`, `token`, `expires_at`, `created_at`) VALUES
(1, 1, 'admin', 'residente', NULL, '61a2452dedb622d0af69bd896b19e90adf06dfc3a9fe3175265fa950d3530877', NULL, '2025-11-07 15:49:51'),
(2, 1, 'admin', 'residente', NULL, 'a3d689c766250aed754ea985d50ea75c53222638d01280a2191933bb3a35d89d', NULL, '2025-11-07 15:49:51'),
(3, 1001, 'residente', 'residente', NULL, 'f557ab81e9e59d031d14932bf9482f94a4b19387436be7d3ecd7b11f7285d835', NULL, '2025-11-07 15:50:34'),
(4, 1001, 'residente', 'residente', NULL, 'bd9b45b41ff6006a07d2dfaf7f5e30ac6326b1d6e507f1188c5a985f691ebaa0', NULL, '2025-11-07 15:50:34'),
(5, 1001, 'residente', 'residente', NULL, '30a569628fe35d07d86a3fcb5b71672ca2371a13029840d185f2f223f6d387b9', NULL, '2025-11-07 15:51:26'),
(6, 1001, 'residente', 'residente', NULL, 'c4264063254d8e707bd75dcaf317b87540e4a6b9218640577ca3e90676f33237', NULL, '2025-11-07 15:51:26'),
(7, 1001, 'residente', 'residente', NULL, '883e30fa875f0b2dca7b936630d56427c95197f52edb27a8481f38b09ab036cb', NULL, '2025-11-07 15:55:06'),
(8, 1001, 'residente', 'residente', NULL, '833280eb4e15ada68afaaae6188ea76df7f671d92f6985044d8c5a03b2d8b661', NULL, '2025-11-07 15:55:06'),
(9, 1001, 'residente', 'residente', NULL, '1759d727677d423f4d72f9af09a41e4f8f885e36e5d4d42730961a3b3be4d469', NULL, '2025-11-07 15:55:20'),
(10, 1001, 'residente', 'residente', NULL, 'eccd5ce1ac7c392c8a4d89f7bc31f9b5f24b3a0d95eec9b79892946ce4b3f13f', NULL, '2025-11-07 15:55:20'),
(11, 1, 'admin', 'residente', NULL, 'db02d92e5bff19ab950a6beca28a809a2a548e069586a58d5bff78027c25b8fa', NULL, '2025-11-07 15:55:38'),
(12, 1, 'admin', 'residente', NULL, '59c9dc83e83b8752baf4bd3cf90c920e08dc197679e444e94a5d8364fd8af7a9', NULL, '2025-11-07 15:55:38'),
(13, 1, 'admin', 'residente', NULL, '2a5650df975337a8ca66efeca3d769d4994cb8a150bf06c3494f38b043f7702f', NULL, '2025-11-07 16:05:49'),
(14, 1, 'admin', 'residente', NULL, '90c6327e4013c2150248e3d3b8f3b5f8eb6f1bd08d371ab10a12cd3c7ef624fc', NULL, '2025-11-07 16:05:49'),
(15, 1001, 'residente', 'residente', NULL, '3306e7bfb7c6a1f6a567544723171d51ba54e88e81cd0e6507aa2846eedb9cb1', NULL, '2025-11-07 16:41:57'),
(16, 1001, 'residente', 'residente', NULL, '17f05f4108e23b092c5ee9a9f9db7b32a3de1ad940efb27b670a54b5a8a663ca', NULL, '2025-11-07 16:41:57'),
(17, 1001, 'residente', 'residente', NULL, 'e2717ba583075dc8cae5c89d69ca069dfa783fa38bb45674f9531d7a859e084c', NULL, '2025-11-07 17:19:51'),
(18, 1001, 'residente', 'residente', NULL, '3f4e6c5e614178c1d7cdc0dfd8922bf47a88e62d55b26e8c7b7cdc60ceddd8ee', NULL, '2025-11-07 17:19:51'),
(19, 1, 'admin', 'residente', NULL, 'd13bd6c785c54e2383eef6d589483cfad8b9df401a316dda0109bc5bbba52efa', NULL, '2025-11-07 17:20:06'),
(20, 1, 'admin', 'residente', NULL, 'ae5feb88f820aace5a832b73d3ec29a2f805808a00b96dc1efe34615f2f5af90', NULL, '2025-11-07 17:20:06'),
(21, 1, 'admin', 'residente', NULL, '5bcbfedec86c07f31545dbff51e7910cab2d21d6db5345a43d8f8e772007b3b5', NULL, '2025-11-07 17:20:31'),
(22, 1, 'admin', 'residente', NULL, 'b5d8e0f5831e7b7cc193d45365b1407dd0f94510146e2af742c206dbcb3a7d11', NULL, '2025-11-07 17:20:31'),
(23, 1001, 'residente', 'residente', NULL, '66e4a0f41c2a3fc2f4e25cec11edf2bbedc8b55118c6fe977da913b286a8d3fe', NULL, '2025-11-07 17:20:37'),
(24, 1001, 'residente', 'residente', NULL, '0ec79a57dbd026e9591afc7e607f25238f22b22ae9ee714aa0aaa162d846e1b6', NULL, '2025-11-07 17:20:37'),
(25, 1, 'admin', 'residente', NULL, 'e06b81d75dce69c9dcda29855c5dc72af5ecaa59df0ca60196b2d77317a89987', NULL, '2025-11-07 17:26:23'),
(26, 1, 'admin', 'residente', NULL, 'a8078ea18d873fc418abcd0ed3fd51afc3b7141085a3179757f710f5c3ff03e2', NULL, '2025-11-07 17:26:23'),
(27, 1001, 'residente', 'residente', NULL, 'ae4cd651a6d732cc60a6dcda62fd995e63260005e6d3db127ae326bc991fb1a6', NULL, '2025-11-07 17:34:40'),
(28, 1001, 'residente', 'residente', NULL, '364cd74b79e6fb0c64315434189f7e88f2a07621123702ea733c294308256556', NULL, '2025-11-07 17:34:40'),
(29, 1001, 'residente', 'residente', NULL, '97768f1afec6645d2aed6cf130a4a1954ddc3e311153977460b107b00ffca842', NULL, '2025-11-07 17:34:50'),
(30, 1001, 'residente', 'residente', NULL, '38d6ec3e1fa2713cb0e04e429e896c8009c3ee3cce07fb6b118e99225bb9925f', NULL, '2025-11-07 17:34:50'),
(31, 1001, 'residente', 'residente', NULL, '5d152a9dc84b5e9b9a0ae0746b475efd7e5e98db62790af46473550f6603c64e', NULL, '2025-11-07 17:34:52'),
(32, 1001, 'residente', 'residente', NULL, '81d2763d47612f71c971695417fb58b7de22bf195d824c9e4241403b7e81b791', NULL, '2025-11-07 17:34:52'),
(33, 1001, 'residente', 'residente', NULL, 'e702f8ce489d1018d5650a5a6ce052056b0fc5528533c7bce42faa5352b89e91', NULL, '2025-11-07 17:42:30'),
(34, 1001, 'residente', 'residente', NULL, '1b4167d0a993cf2fcfd02adfe257b1e392a4dcdd5153c55a0dee7f3b791788a7', NULL, '2025-11-07 17:42:30'),
(35, 1, 'admin', 'residente', NULL, '06b5bec0ceb941f68d6463925ed6fdfd03379595cb810eba3663d9276a794709', NULL, '2025-11-07 17:43:09'),
(36, 1, 'admin', 'residente', NULL, '9c36ad11068a85cd72cda94ea3cfe29e99d4539f21ca6577722aa05359b5e913', NULL, '2025-11-07 17:43:09'),
(37, 1, 'admin', 'residente', NULL, '8583f7d9fe1f351bdd97cde69efe7a95815aceac8602991d2d09bb57c2c78684', NULL, '2025-11-07 17:48:12'),
(38, 1, 'admin', 'residente', NULL, '72d09092df176b1b605ad50ae58b6452f7496a9d859613f39dfbf116914ed477', NULL, '2025-11-07 17:48:13'),
(39, 1, 'admin', 'residente', NULL, 'b83bbd565e7595dcb085f0ea693c40a1f876e360528ed86d3a28e66b3e038572', NULL, '2025-11-07 17:48:13'),
(40, 1, 'admin', 'residente', NULL, '653e4be8835ce3b1ae348b031c095f530ded86d800f39c6a4f5e5ab8fd6ac503', NULL, '2025-11-07 17:48:14'),
(41, 1, 'admin', 'residente', NULL, 'f273f8721a73ac462c59a09a6d5bb3ca2c1e239bfe65dd34c10bf11692657332', NULL, '2025-11-07 17:48:14'),
(42, 1001, 'residente', 'residente', NULL, 'e70cb2de00432d8753fcacd308f919677f652bc0d75f17d0d3e83efc544e6572', NULL, '2025-11-07 17:48:22'),
(43, 1, 'admin', 'residente', NULL, 'b1e6c3b871b291d69d870e8a6174b3689ae614feec3f57cc19f31d45ad71478d', NULL, '2025-11-07 17:55:06'),
(44, 1, 'admin', 'residente', NULL, 'e69fb5a4e860561c7f571b7264f5395182df447a08375102a5c607d3a297e1c0', NULL, '2025-11-07 17:55:06'),
(45, 1, 'admin', 'residente', NULL, '752e7c0332a0a75f5848b0ab4946590fa1244acf479cc6464225882550a10ebf', NULL, '2025-11-07 17:55:08'),
(46, 1, 'admin', 'residente', NULL, '0c103da6fa3999e0dfdca50109017196f971814a6ca703dfd3211861625144aa', NULL, '2025-11-07 17:55:08'),
(47, 1, 'admin', 'residente', NULL, 'eaf7bda0080f52f26e749b38a07724d374e8da5efb25cb174cdd2c88b9fe35da', NULL, '2025-11-07 17:59:27'),
(48, 1, 'admin', 'residente', NULL, '50b82702dec8ec5836685a9e11cdc24747ac90355eed4f81875706d3df7a7161', NULL, '2025-11-07 17:59:27'),
(49, 1, 'admin', 'residente', NULL, '4ffb141cc8de60f9e2c98207e42a570f2503c16f258ad48a72d6ed5129061722', NULL, '2025-11-07 17:59:28'),
(50, 1, 'admin', 'residente', NULL, 'ae4f0c096c370008cac6928f193ffa6e30ab6cd0f153438cf3bd77165fbd859c', NULL, '2025-11-07 17:59:28'),
(51, 1, 'admin', 'residente', NULL, '458b9b0d89861063883c2477834d93626db0a095bc8daf10d2266ccf57647aba', NULL, '2025-11-07 17:59:29'),
(52, 1, 'admin', 'residente', NULL, '7aba56d030c9332578bf5b7a22aa06db0b82651610501cebad56b8a9a2f3f9cb', NULL, '2025-11-07 17:59:29'),
(53, 1, 'admin', 'residente', NULL, '979ccf150a2fb3e332427cd70f3823b45e290ffe99c5a702ad3d7ae8f44c6aed', NULL, '2025-11-07 17:59:30'),
(54, 1, 'admin', 'residente', NULL, '93937b73572eab7d13a4918d95039555fc400132f0bf192d032d31fbc36bad64', NULL, '2025-11-07 17:59:30'),
(55, 1, 'admin', 'residente', NULL, '2d9562766c5dd56835f434b74c5959854c1ff8e0bce6bb6dba1fa5dcf22b1687', NULL, '2025-11-07 17:59:58'),
(56, 1, 'admin', 'residente', NULL, 'd36c57e9a72fbef02059fab0762fe0136be07d91effd4b47665d8d0073218763', NULL, '2025-11-07 17:59:58'),
(57, 1001, 'residente', 'residente', NULL, '2cbb553309e8d0fc7eea7b3748cb63606b14401f3c79cc75284fb471664fb5ef', NULL, '2025-11-07 18:00:11'),
(58, 1001, 'residente', 'residente', NULL, '14267802990f9eecdc92c92fec5d5524355942a7257f0e31b2144dbcf4c8774e', NULL, '2025-11-07 18:00:11'),
(59, 1001, 'residente', 'residente', NULL, '6081ae6a42bd18c77032ee971c6cd3836928223e26fd2125d6eb2e105063f89f', NULL, '2025-11-07 18:10:13'),
(60, 1001, 'residente', 'residente', NULL, '69e79dfdb99b0ec45da43c8e421378e229a6392226004f614fb4b306d83718ad', NULL, '2025-11-07 18:10:13'),
(61, 1, 'residente', 'admin', NULL, '4d5e65ec01f9e1931530245f1ec98d8c38a8c800e3b34decd70df2fd0c06db18', '2025-11-08 06:15:23', '2025-11-07 18:15:23'),
(62, 1001, 'residente', 'residente', NULL, '9527cc5b0244897bab658aa32ab5faf6f68a06f3f928498bf2961545b6b56da0', '2025-11-08 06:15:30', '2025-11-07 18:15:30'),
(63, 1001, 'residente', 'residente', NULL, '6b04a7bbb88a0e5b76fdbb7d0c3119bf75d8e28f125e0718d52001d85bc67931', '2025-11-08 06:32:23', '2025-11-07 18:32:23');

-- --------------------------------------------------------

--
-- Table structure for table `comprobante`
--

CREATE TABLE `comprobante` (
  `id_Comprobante` int(11) NOT NULL,
  `Tipo` varchar(100) NOT NULL,
  `Fecha` date NOT NULL,
  `Monto` decimal(10,2) DEFAULT NULL,
  `Estado` varchar(50) NOT NULL DEFAULT 'Pendiente',
  `Archivo` varchar(255) NOT NULL,
  `Fecha_Subida` datetime DEFAULT current_timestamp(),
  `id_Residente` int(11) NOT NULL,
  `id_Administrador` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comprobantes_pago`
--

CREATE TABLE `comprobantes_pago` (
  `id_Comprobante` int(11) NOT NULL,
  `Tipo` varchar(100) NOT NULL,
  `Fecha` date NOT NULL,
  `Monto` decimal(10,2) DEFAULT NULL,
  `Estado` varchar(50) NOT NULL DEFAULT 'Pendiente',
  `Archivo` varchar(255) NOT NULL,
  `Fecha_Subida` datetime DEFAULT current_timestamp(),
  `id_Residente` int(11) NOT NULL,
  `id_Administrador` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comunicados`
--

CREATE TABLE `comunicados` (
  `Id_Aviso` int(11) NOT NULL,
  `Titulo` varchar(255) NOT NULL,
  `Fecha` datetime DEFAULT current_timestamp(),
  `Destinatario` varchar(255) DEFAULT NULL,
  `Contenido` text DEFAULT NULL,
  `id_Administrador` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `horas_trabajo`
--

CREATE TABLE `horas_trabajo` (
  `id_Hora` int(11) NOT NULL,
  `id_Residente` int(11) NOT NULL,
  `Fecha` date NOT NULL,
  `Cantidad` decimal(5,2) NOT NULL,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Fecha_Registro` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pagos`
--

CREATE TABLE `pagos` (
  `Id_Pagos` int(11) NOT NULL,
  `Monto` decimal(10,2) NOT NULL,
  `Medio` varchar(50) DEFAULT NULL,
  `Fecha` datetime DEFAULT current_timestamp(),
  `Estado` varchar(50) DEFAULT NULL,
  `id_Residente` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `postulante`
--

CREATE TABLE `postulante` (
  `id_Postulante` int(11) NOT NULL,
  `Usuario` varchar(50) NOT NULL,
  `Contrasena` varchar(255) NOT NULL,
  `Nombre` varchar(100) DEFAULT NULL,
  `Apellido` varchar(100) DEFAULT NULL,
  `Correo` varchar(100) DEFAULT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Fecha_Registro` datetime DEFAULT current_timestamp(),
  `id_Vivienda` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reclamos`
--

CREATE TABLE `reclamos` (
  `Id_Reclamo` int(11) NOT NULL,
  `Descripcion` text NOT NULL,
  `Fecha` datetime DEFAULT current_timestamp(),
  `Prioridad` varchar(50) DEFAULT NULL,
  `Estado` varchar(50) DEFAULT NULL,
  `id_Residente` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reservas`
--

CREATE TABLE `reservas` (
  `id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `id_Espacio` int(11) DEFAULT NULL,
  `id_Residente` int(11) DEFAULT NULL,
  `estado` enum('pendiente','aprobado','rechazado','cancelado') DEFAULT 'pendiente',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `residente`
--

CREATE TABLE `residente` (
  `id_Residente` int(11) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Apellido` varchar(100) NOT NULL,
  `Cedula` varchar(20) DEFAULT NULL,
  `Correo` varchar(100) NOT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Fecha_Ingreso` date NOT NULL,
  `id_Vivienda` int(11) DEFAULT NULL,
  `Contrasena` varchar(255) NOT NULL,
  `estado_aprobacion` tinyint(1) DEFAULT 0,
  `fecha_registro` datetime DEFAULT current_timestamp(),
  `Usuario` varchar(120) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `residente`
--

INSERT INTO `residente` (`id_Residente`, `Nombre`, `Apellido`, `Cedula`, `Correo`, `Telefono`, `Fecha_Ingreso`, `id_Vivienda`, `Contrasena`, `estado_aprobacion`, `fecha_registro`, `Usuario`) VALUES
(1001, 'Santiago', 'Residente', '1.234.567-8', 'user@fans.test', '099000000', '2025-11-07', NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, '2025-11-07 14:21:50', 'usuario1');

-- --------------------------------------------------------

--
-- Table structure for table `vivienda`
--

CREATE TABLE `vivienda` (
  `id_Vivienda` int(11) NOT NULL,
  `Numero` varchar(20) NOT NULL,
  `Direccion` varchar(255) NOT NULL,
  `Tipo` varchar(50) DEFAULT NULL,
  `Estado` varchar(50) DEFAULT NULL,
  `id_Administrador` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `administrador`
--
ALTER TABLE `administrador`
  ADD PRIMARY KEY (`id_Administrador`),
  ADD UNIQUE KEY `Usuario` (`Usuario`),
  ADD UNIQUE KEY `Correo` (`Correo`);

--
-- Indexes for table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_token_hash` (`token_hash`),
  ADD UNIQUE KEY `uniq_token` (`token`),
  ADD KEY `idx_user` (`user_id`,`user_role`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Indexes for table `comprobante`
--
ALTER TABLE `comprobante`
  ADD PRIMARY KEY (`id_Comprobante`),
  ADD KEY `id_Residente` (`id_Residente`),
  ADD KEY `id_Administrador` (`id_Administrador`);

--
-- Indexes for table `comprobantes_pago`
--
ALTER TABLE `comprobantes_pago`
  ADD PRIMARY KEY (`id_Comprobante`),
  ADD KEY `fk_comp_res` (`id_Residente`),
  ADD KEY `fk_comp_admin` (`id_Administrador`);

--
-- Indexes for table `comunicados`
--
ALTER TABLE `comunicados`
  ADD PRIMARY KEY (`Id_Aviso`),
  ADD KEY `id_Administrador` (`id_Administrador`);

--
-- Indexes for table `horas_trabajo`
--
ALTER TABLE `horas_trabajo`
  ADD PRIMARY KEY (`id_Hora`),
  ADD KEY `fk_horas_res` (`id_Residente`);

--
-- Indexes for table `pagos`
--
ALTER TABLE `pagos`
  ADD PRIMARY KEY (`Id_Pagos`),
  ADD KEY `id_Residente` (`id_Residente`);

--
-- Indexes for table `postulante`
--
ALTER TABLE `postulante`
  ADD PRIMARY KEY (`id_Postulante`),
  ADD UNIQUE KEY `Usuario` (`Usuario`),
  ADD UNIQUE KEY `Correo` (`Correo`),
  ADD KEY `id_Vivienda` (`id_Vivienda`);

--
-- Indexes for table `reclamos`
--
ALTER TABLE `reclamos`
  ADD PRIMARY KEY (`Id_Reclamo`),
  ADD KEY `id_Residente` (`id_Residente`);

--
-- Indexes for table `reservas`
--
ALTER TABLE `reservas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reservas_fecha` (`fecha`),
  ADD KEY `idx_reservas_residente` (`id_Residente`);

--
-- Indexes for table `residente`
--
ALTER TABLE `residente`
  ADD PRIMARY KEY (`id_Residente`),
  ADD UNIQUE KEY `Correo` (`Correo`),
  ADD UNIQUE KEY `Cedula` (`Cedula`),
  ADD UNIQUE KEY `Usuario` (`Usuario`),
  ADD KEY `id_Vivienda` (`id_Vivienda`);

--
-- Indexes for table `vivienda`
--
ALTER TABLE `vivienda`
  ADD PRIMARY KEY (`id_Vivienda`),
  ADD UNIQUE KEY `Numero` (`Numero`),
  ADD KEY `id_Administrador` (`id_Administrador`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `administrador`
--
ALTER TABLE `administrador`
  MODIFY `id_Administrador` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `comprobante`
--
ALTER TABLE `comprobante`
  MODIFY `id_Comprobante` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `comprobantes_pago`
--
ALTER TABLE `comprobantes_pago`
  MODIFY `id_Comprobante` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `comunicados`
--
ALTER TABLE `comunicados`
  MODIFY `Id_Aviso` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `horas_trabajo`
--
ALTER TABLE `horas_trabajo`
  MODIFY `id_Hora` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `pagos`
--
ALTER TABLE `pagos`
  MODIFY `Id_Pagos` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `postulante`
--
ALTER TABLE `postulante`
  MODIFY `id_Postulante` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reclamos`
--
ALTER TABLE `reclamos`
  MODIFY `Id_Reclamo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reservas`
--
ALTER TABLE `reservas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `residente`
--
ALTER TABLE `residente`
  MODIFY `id_Residente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1002;

--
-- AUTO_INCREMENT for table `vivienda`
--
ALTER TABLE `vivienda`
  MODIFY `id_Vivienda` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `comprobante`
--
ALTER TABLE `comprobante`
  ADD CONSTRAINT `comprobante_ibfk_1` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE CASCADE,
  ADD CONSTRAINT `comprobante_ibfk_2` FOREIGN KEY (`id_Administrador`) REFERENCES `administrador` (`id_Administrador`) ON DELETE SET NULL;

--
-- Constraints for table `comprobantes_pago`
--
ALTER TABLE `comprobantes_pago`
  ADD CONSTRAINT `fk_comp_admin` FOREIGN KEY (`id_Administrador`) REFERENCES `administrador` (`id_Administrador`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_comp_res` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE CASCADE;

--
-- Constraints for table `comunicados`
--
ALTER TABLE `comunicados`
  ADD CONSTRAINT `comunicados_ibfk_1` FOREIGN KEY (`id_Administrador`) REFERENCES `administrador` (`id_Administrador`) ON DELETE CASCADE;

--
-- Constraints for table `horas_trabajo`
--
ALTER TABLE `horas_trabajo`
  ADD CONSTRAINT `fk_horas_res` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE CASCADE;

--
-- Constraints for table `pagos`
--
ALTER TABLE `pagos`
  ADD CONSTRAINT `pagos_ibfk_1` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE CASCADE;

--
-- Constraints for table `postulante`
--
ALTER TABLE `postulante`
  ADD CONSTRAINT `postulante_ibfk_1` FOREIGN KEY (`id_Vivienda`) REFERENCES `vivienda` (`id_Vivienda`) ON DELETE SET NULL;

--
-- Constraints for table `reclamos`
--
ALTER TABLE `reclamos`
  ADD CONSTRAINT `reclamos_ibfk_1` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE CASCADE;

--
-- Constraints for table `reservas`
--
ALTER TABLE `reservas`
  ADD CONSTRAINT `fk_reservas_residente` FOREIGN KEY (`id_Residente`) REFERENCES `residente` (`id_Residente`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `residente`
--
ALTER TABLE `residente`
  ADD CONSTRAINT `fk_res_vivienda` FOREIGN KEY (`id_Vivienda`) REFERENCES `vivienda` (`id_Vivienda`) ON DELETE SET NULL,
  ADD CONSTRAINT `residente_ibfk_1` FOREIGN KEY (`id_Vivienda`) REFERENCES `vivienda` (`id_Vivienda`) ON DELETE SET NULL;

--
-- Constraints for table `vivienda`
--
ALTER TABLE `vivienda`
  ADD CONSTRAINT `vivienda_ibfk_1` FOREIGN KEY (`id_Administrador`) REFERENCES `administrador` (`id_Administrador`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
