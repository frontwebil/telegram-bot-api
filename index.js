import "dotenv/config";
import { Bot, Api } from "node-telegram-bot-api";
import cors from "cors";
import express from "express";
import {
  WELCOME_MESSAGE,
  DELIVERY_MESSAGE,
  BENEFITS_MESSAGE,
  HELP_MESSAGE,
} from "./markups.js";
import prisma from "./lib/prisma.js";

const token = process.env.BOT_TOKEN;
const WEB_APP_URL = "https://test-site-learn.vercel.app";

const bot = new Bot(token);
const api = new Api(token);

const app = express();

app.use(express.json());
app.use(cors());

function requireApiSecret(req, res, next) {
  const secret = process.env.API_SECRET;
  const receivedSecret = req.get("x-api-secret");

  if (!secret || !receivedSecret || receivedSecret !== secret) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  next();
}

bot.on("message", async (msg) => {
  const chat_id = msg.update.message.chat.id;
  const text = msg.update.message.text;
  const user_chat = msg.update.message.chat;

  console.log(chat_id);

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

  if (text === "/orders") {
    const orders = await prisma.order.findMany({
      where: {
        userChatId: String(chat_id),
      },
      orderBy: {
        id: "desc",
      },
    });

    if (orders.length === 0) {
      await api.sendMessage({
        chat_id,
        text: "У вас немає замовлень",
      });
      return;
    }

    const statusNames = {
      New: "Очікує підтвердження",
      Confirm: "Прийняте",
      Delived: "У дорозі",
      Delivered: "Доставлене",
    };

    for (const order of orders) {
      let products = order.products || [];

      if (typeof products === "string") {
        try {
          products = JSON.parse(products);
        } catch {
          products = [];
        }
      }

      const total = Array.isArray(products)
        ? products.reduce(
            (sum, product) =>
              sum +
              Number(
                product.totalPrice ??
                  Number(product.price || 0) * Number(product.quantity || 0),
              ),
            0,
          )
        : 0;

      const createdAt = order.createdAt
        ? new Date(order.createdAt).toLocaleString("uk-UA", {
            timeZone: "Europe/Kyiv",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Не вказано";

      const message =
        `Номер: ${order.id}\n` +
        `Дата замовлення: ${createdAt}\n` +
        `Статус: ${statusNames[order.status] || order.status}\n\n` +
        `*Сума: ${total} грн*`;

      await api.sendMessage({
        chat_id,
        text: message,
        parse_mode: "Markdown",
      });
    }
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

api
  .setMyCommands([
    { command: "start", description: "🏠 Головне меню" },
    { command: "catalog", description: "🛍️ Відкрити каталог" },
    { command: "orders", description: "📦 Мої замовлення" },
    { command: "delivery", description: "🚚 Доставка та оплата" },
    { command: "benefits", description: "ℹ️ Інформація про магазин" },
    { command: "help", description: "💬 Допомога та контакти" },
  ])
  .then(() => console.log("Команди бота успішно зареєстровані"))
  .catch((error) => console.error("Помилка реєстрації команд:", error));

bot.startPolling();

const PORT = 8000;

app.post("/api/order", requireApiSecret, async (req, res) => {
  try {
    const order = req.body;

    console.log("Creating order!", order);

    await prisma.order.create({
      data: {
        id: BigInt(order.id),
        name: order.name ?? "Не вказано",
        status: order.status ?? "New",
        phone: order.phone ?? "",
        adress: order.adress ?? "",
        delivery: order.delivery ?? "",
        paymentType: order.paymentType ?? "",
        prefferContactMethod: order.prefferContactMethod ?? "",
        userChatId: String(order.userChatId ?? ""),
        userTelegram: order.userTelegram ?? "",
        products: order.products ?? [],
      },
    });

    const products = Array.isArray(order.products) ? order.products : [];

    const deliveryNames = {
      "nova-poshta": "Нова пошта",
      "nova-poshta-branch": "Нова пошта - відділення",
      "nova-poshta-postomat": "Нова пошта - поштомат",
      ukrposhta: "Укрпошта",
    };

    const paymentNames = {
      "cash-on-delivery": "Післяплата",
      "bank-transfer": "Оплата на банківський рахунок",
    };

    const contactNames = {
      telegram: "Telegram",
      "phone-call": "Телефонний дзвінок",
      "no-contact": "Не контактувати",
    };

    const total = products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.totalPrice ??
            Number(product.price || 0) * Number(product.quantity || 0),
        ),
      0,
    );

    const notification =
      `НОВЕ ЗАЯВКА №${order.id}\n\n` +
      `Ім'я: ${order.name || "Не вказано"}\n` +
      `Телефон: ${order.phone || "Не вказано"}\n` +
      `Оплата: ${paymentNames[order.paymentType] || order.paymentType || "Не вказано"}\n` +
      `ЗАГАЛЬНА СУМА: ${total} грн\n\n` +
      `Статус: 🆕 Нове`;

    const telegramApiUrl = `https://api.telegram.org/bot${process.env.API_BOT_NOTIFICATION}/sendMessage`;

    if (process.env.NOTIFICATION_CHAT) {
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.NOTIFICATION_CHAT,
          text: notification,
        }),
      });
    }

    await api.sendMessage({
      chat_id: order.userChatId,
      text:
        "Ваше замовлення прийнято!\n\n" +
        "Дякуємо за замовлення в India Pharm.\n" +
        "Найближчим часом з вами зв'яжеться наш менеджер для уточнення деталей замовлення.",
    });

    console.log("Order is created!");

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

app.post("/api/notificationTelegram", requireApiSecret, async (req, res) => {
  try {
    const { order } = req.body;

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Замовлення не передано",
      });
    }

    if (!order.userChatId || !/^\d+$/.test(String(order.userChatId))) {
      return res.status(400).json({
        success: false,
        message: "Некоректний Telegram Chat ID",
      });
    }

    const statusMessages = {
      New: {
        title: "🆕 Замовлення створено!",
        description: `Ваше замовлення №${order.id} створено. Очікуйте підтвердження.`,
      },
      Confirm: {
        title: "✅ Замовлення підтвердженно!",
        description: `Ваше замовлення №${order.id} прийнято в роботу. Очікуйте ТТН після відправки. Дякуємо, що обрали India Pharm!`,
      },
      Delived: {
        title: "Замовлення в дорозі!",
        description: `Ваше замовлення №${order.id} вже в дорозі.`,
      },
      Delivered: {
        title: "Замовлення доставлено!",
        description: `Ваше замовлення №${order.id} доставлено. Дякуємо за покупку в India Pharm!`,
      },
    };

    const statusMessage = statusMessages[order.status];

    if (!statusMessage) {
      return res.status(400).json({
        success: false,
        message: `Невідомий статус: ${order.status}`,
      });
    }

    const message =
      `${statusMessage.title}\n\n` +
      `${statusMessage.description}` +
      (order.ttn ? `\n\n🔢 Номер ТТН: ${order.ttn}` : "");

    await api.sendMessage({
      chat_id: order.userChatId,
      text: message,
    });

    return res.status(200).json({
      success: true,
      message: "Сповіщення надіслано",
    });
  } catch (error) {
    console.error("Telegram notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Не вдалося надіслати сповіщення",
    });
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Server is working!");
});

app.listen(PORT, () => console.log("server is started on PORT " + PORT));
