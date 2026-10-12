import "dotenv/config";
import { Bot, Api } from "node-telegram-bot-api";
import cors from "cors";
import express from "express";
import {
  WELCOME_MESSAGE,
  FAQ_MESSAGE,
  DELIVERY_MESSAGE,
  BENEFITS_MESSAGE,
  HELP_MESSAGE,
} from "./markups.js";
import prisma from "./lib/prisma.js";

const token = process.env.BOT_TOKEN;
const WEB_APP_URL = "https://india-pharm.vercel.app/";

const bot = new Bot(token);
const api = new Api(token);

const app = express();

app.use(express.json());
app.use(cors());

bot.on("message", async (msg) => {
  const chat_id = msg.update.message.chat.id;
  const text = msg.update.message.text;
  const user_chat = msg.update.message.chat;

  const isExist = await prisma.user.findMany({
    where: {
      user_id: chat_id,
    },
  });

  if (isExist.length == 0) {
    console.log("Start Creating");
    const user = await prisma.user.create({
      data: {
        name: user_chat.first_name,
        user_id: user_chat.id,
        userName: user_chat.username,
      },
    });

    console.log("User Created");
    console.log(user);
  }

  if (text === "/start") {
    await api.sendMessage({
      chat_id,
      text: WELCOME_MESSAGE,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Відкрити магазин",
              web_app: { url: WEB_APP_URL },
            },
          ],
        ],
      },
    });
  }

  if (text === "/catalog") {
    await api.sendMessage({
      chat_id,
      text: "Натисніть кнопку нижче, щоб відкрити повний каталог товарів *India Pharm* 👇",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛒 Каталог товарів",
              web_app: { url: WEB_APP_URL + "/catalog" },
            },
          ],
        ],
      },
    });
  }

  if (text === "/faq") {
    await api.sendMessage({
      chat_id,
      text: FAQ_MESSAGE,
      parse_mode: "Markdown",
    });
  }

  if (text === "/delivery") {
    await api.sendMessage({
      chat_id,
      text: DELIVERY_MESSAGE,
      parse_mode: "Markdown",
    });
  }

  if (text === "/benefits") {
    await api.sendMessage({
      chat_id,
      text: BENEFITS_MESSAGE,
      parse_mode: "Markdown",
    });
  }

  if (text === "/help") {
    await api.sendMessage({
      chat_id,
      text: HELP_MESSAGE,
      parse_mode: "Markdown",
    });
  }
});

bot.startPolling();

const PORT = 8000;

app.post("/api/order", async (req, res) => {
  try {
    const order = req.body;

    console.log(order);

    console.log("Creating order!");
    await prisma.order.create({
      data: {
        id: order.id,
        name: order.name ?? "Не вказано",
        status: order.status ?? "New",
        phone: order.phone ?? "",
        adress: order.adress ?? "",
        delivery: order.delivery ?? "",
        paymentType: order.paymentType ?? "",
        prefferContactMethod: order.prefferContactMethod ?? "",
        userChatId: order.userChatId ?? "",
        userTelegram: order.userTelegram ?? "",
        products: order.products ?? "",
      },
    });

    console.log("Order is created!");

    await api.sendMessage({
      chat_id: order.userChatId,
      text: "✅ Ваше замовлення прийнято! \n Дякуємо за покупку в India Pharm. \n Очікуйте на подальшу інформацію щодо замовлення.",
    });

    return res.status(200).json({
      success: true,
      message: "Замовлення отримано",
      data: order,
    });
  } catch (error) {
    console.error("API error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Server is working!");
});

app.listen(PORT, () => console.log("server is started on PORT " + PORT));
