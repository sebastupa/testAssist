const express = require("express");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

const app = express();
const port = 3000;

app.use(bodyParser.json());

const sequelize = new Sequelize("TestAssist", "sebas", "1111", {
  host: "localhost",
  dialect: "postgres",
});

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const UserPreferences = sequelize.define("UserPreferences", {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  timezone: {
    type: DataTypes.STRING,
  },
  country: {
    type: DataTypes.STRING,
  },
});

const Job = sequelize.define("Job", {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  company_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  remote: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  job_types: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  added_by: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: "id",
    },
    allowNull: false,
  },
});

User.hasOne(UserPreferences, { foreignKey: "user_id" });
UserPreferences.belongsTo(User, { foreignKey: "user_id" });
Job.belongsTo(User, { foreignKey: "added_by" });

async function syncModels() {
  try {
    await sequelize.sync({ force: true });
    console.log("Modele sincronizate cu baza de date");
  } catch (error) {
    console.error("Eroare la sincronizare modele:", error);
  } finally {
    await sequelize.close();
  }
}

syncModels();

// Endpoint sign-up
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      name,
      email,
      passwordHash: hashedPassword,
    });

    await UserPreferences.create({
      user_id: newUser.id,
      timezone: null,
      country: null,
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error("Eroare la înregistrare:", error);
    res.status(500).json({ error: "Eroare la înregistrare" });
  }
});

// resetarea parolei
app.post("/reset-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu există" });
    }

    const randomPassword = generateRandomPassword();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

    await user.update({
      passwordHash: hashedPassword,
    });

    res.status(200).json({
      message: "Parola a fost resetată cu succes",
      newPassword: randomPassword,
    });
  } catch (error) {
    console.error("Eroare la resetarea parolei:", error);
    res.status(500).json({ error: "Eroare la resetarea parolei" });
  }
});

// endpoint pentru a adauga preferinte de utilizator
app.post("/user-preferences", async (req, res) => {
  const { userId, timezone, country } = req.body;

  try {
    const userPreferences = await UserPreferences.create({
      user_id: userId,
      timezone,
      country,
    });

    res.status(201).json(userPreferences);
  } catch (error) {
    console.error("Eroare la adăugarea preferințelor utilizatorului:", error);
    res
      .status(500)
      .json({ error: "Eroare la adăugarea preferințelor utilizatorului" });
  }
});

app.put("/update-preferences/:userId", async (req, res) => {
  const { userId } = req.params;
  const { timezone, country } = req.body;

  try {
    const userPreferences = await UserPreferences.findOne({
      where: { user_id: userId },
    });

    if (!userPreferences) {
      return res
        .status(404)
        .json({ error: "Preferințele utilizatorului nu au fost găsite" });
    }

    await userPreferences.update({ timezone, country });

    res.status(200).json({
      message: "Preferințele utilizatorului au fost actualizate cu succes",
    });
  } catch (error) {
    console.error(
      "Eroare la actualizarea preferințelor utilizatorului:",
      error
    );
    res
      .status(500)
      .json({ error: "Eroare la actualizarea preferințelor utilizatorului" });
  }
});

app.post("/add-job", async (req, res) => {
  const { title, company_name, location, remote, job_types } = req.body;
  const addedByUserId = req.get("X-AUTH-USER");

  try {
    const addedByUser = await User.findByPk(addedByUserId);

    if (!addedByUser) {
      return res
        .status(404)
        .json({ error: "Utilizatorul care adaugă locul de muncă nu există" });
    }

    const newJob = await Job.create({
      title,
      company_name,
      location,
      remote,
      job_types,
      added_by: addedByUserId,
    });

    res.status(201).json(newJob);
  } catch (error) {
    console.error("Eroare la adăugarea locului de muncă:", error);
    res.status(500).json({ error: "Eroare la adăugarea locului de muncă" });
  }
});

app.listen(port, () => {
  console.log(`Serverul rulează la adresa http://localhost:${port}`);
});

function generateRandomPassword() {
  const uppercaseLetter = String.fromCharCode(
    Math.floor(Math.random() * 26) + 65
  );
  const numbers = Math.floor(10000 + Math.random() * 90000);
  const randomPassword = uppercaseLetter + numbers.toString().substring(0, 5);
  return randomPassword;
}
