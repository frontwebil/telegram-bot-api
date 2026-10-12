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

    for (const [index, order] of orders.entries()) {
      let products = order.products || [];

      if (typeof products === "string") {
        try {
          products = JSON.parse(products);
        } catch {
          products = [];
        }
      }

      const productsText = Array.isArray(products)
        ? products
            .map(
              (product) =>
                `• ${product.name}\n` +
                `  📦 ${product.packageName || product.selectedVariant || "Не вказано"}\n` +
                `  🔢 Кількість: ${product.quantity}\n` +
                `  💵 Ціна: ${product.price} грн`,
            )
            .join("\n\n")
        : "Немає інформації про товари";

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

      const message =
        `Номер: ${order.id}\n` +
        `Статус: ${statusNames[order.status] || order.status}\n\n` +
        `*Товари:*\n${productsText}\n\n` +
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

bot.startPolling();

const PORT = 8000;

app.post("/api/order", async (req, res) => {
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
    };

    const productsText = products
      .map(
        (product, index) =>
          `${index + 1}. ${product.name}\n` +
          `   📦 Фасування: ${product.packageName || product.selectedVariant || "Не вказано"}\n` +
          `   🔢 Кількість: ${product.quantity}\n` +
          `   💵 Ціна: ${product.price} грн\n` +
          `   💰 Сума: ${product.totalPrice ?? product.price * product.quantity} грн`,
      )
      .join("\n\n");

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
      `🆕 НОВЕ ЗАМОВЛЕННЯ №${order.id}\n\n` +
      `👤 Ім'я: ${order.name || "Не вказано"}\n` +
      `📞 Телефон: ${order.phone || "Не вказано"}\n` +
      `👤 Telegram: ${order.userTelegram ? "@" + order.userTelegram : "Не вказано"}\n` +
      `📍 Адреса: ${order.adress || "Не вказано"}\n\n` +
      `🚚 Доставка: ${deliveryNames[order.delivery] || order.delivery || "Не вказано"}\n` +
      `💳 Оплата: ${paymentNames[order.paymentType] || order.paymentType || "Не вказано"}\n` +
      `💬 Зв'язок: ${contactNames[order.prefferContactMethod] || order.prefferContactMethod || "Не вказано"}\n\n` +
      `🛍 ТОВАРИ:\n${productsText || "Товари не вказані"}\n\n` +
      `💰 ЗАГАЛЬНА СУМА: ${total} грн\n\n` +
      `📌 Статус: 🆕 Нове`;

    await api.sendMessage({
      chat_id: process.env.NOTIFICATION_CHAT,
      text: notification,
    });

    await api.sendMessage({
      chat_id: order.userChatId,
      text:
        "✅ Ваше замовлення прийнято!\n\n" +
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

app.get("/", (req, res) => {
  res.status(200).send("Server is working!");
});

app.listen(PORT, () => console.log("server is started on PORT " + PORT));
